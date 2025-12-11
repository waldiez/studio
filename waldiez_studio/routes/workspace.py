# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# pyright: reportCallInDefaultInitializer=false,reportUnknownMemberType=false

"""Workspace API routes."""

import logging
import shutil
import tempfile
from pathlib import Path
from typing import Any

import aiofiles
import aiosqlite
import puremagic
from aiofiles import os
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.responses import FileResponse, ORJSONResponse, Response

from waldiez_studio.models import (
    MessageResponse,
    PathItem,
    PathItemCreateRequest,
    PathItemListResponse,
    PathItemRenameRequest,
    PathItemType,
    SaveRequest,
)
from waldiez_studio.utils.sync import sync_to_async

from .common import (
    ALLOWED_EXTENSIONS,
    TEXTUAL_EXTS,
    check_path,
    get_new_file_name,
    get_new_folder_name,
    get_root_directory,
    safe_rel,
)

api = APIRouter()
LOG = logging.getLogger(__name__)

CHUNK_SIZE = 1024 * 1024  # 1 MB chunks
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB maximum file size
MAX_FILE_SIZE_MB = f"{MAX_FILE_SIZE / 1024 / 1024:.1f}"
SQLITE_EXTS = {".db", ".sqlite", ".sqlite3"}


@api.get("/workspace", response_model=PathItemListResponse)
async def list_items(
    parent: str | None = Query(
        default=None,
        description=(
            "The directory path to list. "
            "If not provided, the root directory will be listed."
        ),
    ),
    root_dir: Path = Depends(get_root_directory),
) -> PathItemListResponse:
    """
    List files and folders in a directory.

    Parameters
    ----------
    parent : Optional[str]
        The directory path to list.
        If not provided, the root directory will be listed.
    root_dir : Path
        The root directory to use.

    Returns
    -------
    PathItemListResponse
        A list of files and folders in the specified directory.

    Raises
    ------
    HTTPException
        If the directory does not exist.
    """
    target_dir = (
        root_dir
        if not parent
        else check_path(parent, root_dir=root_dir, must_be_dir=True)
    )

    def sync_list_items(directory: Path) -> list[PathItem]:
        """List files and folders in a given directory.

        Parameters
        ----------
        directory : Path
            The directory to list.

        Returns
        -------
        list[PathItem]
            A list of files and folders in the specified directory.
        """
        parent_rel = Path(parent.strip("/")) if parent else Path()
        items: list[PathItem] = []
        for item in directory.iterdir():
            rel_path = (parent_rel / item.name).as_posix()
            items.append(
                PathItem(
                    name=item.name,
                    path=rel_path,
                    type="folder" if item.is_dir() else "file",
                )
            )
        return sorted(items, key=lambda p: (p.type == "file", p.name.lower()))

    entries: list[PathItem] = []
    try:
        entries = await sync_to_async(sync_list_items)(target_dir)
    except ValueError as error:
        LOG.warning(error)
        raise HTTPException(400, detail="Failed to list items") from error
    return PathItemListResponse(items=entries)


@api.post(
    "/workspace",
    response_model=PathItem,
    responses={
        "200": {"description": "The newly created file or folder"},
        "400": {"description": "Error: Invalid path"},
        "404": {"description": "Error: Path or parent directory not found"},
    },
)
async def create_file_or_folder(
    data: PathItemCreateRequest,
    root_dir: Path = Depends(get_root_directory),
) -> PathItem:
    """Create a new file or folder in the root directory.

    Parameters
    ----------
    data : PathItemCreateRequest
        The type of the item to create ("file" or "folder")
        and the parent folder path.
    root_dir : Path
        The root directory to use.

    Returns
    -------
    PathItem
        The newly created file or folder.

    Raises
    ------
    HTTPException
        If the file or folder already exists.
    """
    target_dir = (
        root_dir
        if not data.parent
        else check_path(data.parent, root_dir=root_dir, must_be_dir=True)
    )

    new_name = (
        get_new_folder_name(target_dir, "New Folder")
        if data.type == "folder"
        else get_new_file_name(target_dir, "Untitled.waldiez")
    )
    full_path = target_dir / new_name
    if full_path.exists():
        raise HTTPException(
            status_code=400, detail="Error: File or folder already exists"
        )
    return await create_new_path_item(
        full_path, item_type=data.type, root_dir=root_dir
    )


@api.post(
    "/workspace/rename",
    response_model=PathItem,
    responses={
        "200": {"description": "The renamed file or folder"},
        "400": {"description": "Error: Invalid path"},
        "404": {"description": "Error: Source file or folder does not exist"},
        "500": {"description": "Failed to rename file or folder"},
    },
)
async def rename_file_or_folder(
    data: PathItemRenameRequest,
    root_dir: Path = Depends(get_root_directory),
) -> PathItem:
    """
    Rename a file or folder.

    Parameters
    ----------
    data : PathItemRenameRequest
        The old and new paths for the file or folder.
    root_dir : Path
        The root directory to use.

    Returns
    -------
    PathItem
        The renamed file or folder.

    Raises
    ------
    HTTPException
        If the old path does not exist,
        the new path already exists,
        or renaming fails.
    """
    old_path = data.old_path
    new_path = data.new_path
    old_target = check_path(old_path, root_dir=root_dir, must_exist=True)
    new_target = check_path(
        new_path, root_dir=root_dir, must_exist=False, must_not_exist=True
    )
    try:
        old_target.rename(new_target)
    except BaseException as error:
        raise HTTPException(
            status_code=500, detail="Failed to rename file or folder"
        ) from error

    return PathItem(
        name=new_target.name,
        path=safe_rel(new_target, root=root_dir),
        type="folder" if new_target.is_dir() else "file",
    )


@api.post(
    "/workspace/save",
    response_model=MessageResponse,
    responses={
        "200": {"description": "The file was saved"},
        "400": {"description": "Error: Invalid request"},
        "404": {"description": "Error: File not found"},
        "415": {"description": "Error: Unsupported file type"},
        "500": {"description": "Failed to save file"},
    },
)
async def save_text_file(
    payload: SaveRequest,
    root_dir: Path = Depends(get_root_directory),
) -> MessageResponse:
    """
    Save a textual file (UTF-8).

    Parameters
    ----------
    payload : SaveRequest
        The file contents to store.
    root_dir : Path
        The root directory to use.

    Returns
    -------
    MessageResponse
        A success message.

    Raises
    ------
    HTTPException
        If the path does not exist,
        the file type is not supported
        or saving the file fails.
    """
    try:
        file_path = check_path(
            payload.path,
            root_dir,
            path_type="File",
            must_exist=True,
            must_be_file=True,
            must_be_dir=False,
        )
    except BaseException as exc:
        raise HTTPException(status_code=404, detail="File not found") from exc

    ext = file_path.suffix.lower()
    mime = ALLOWED_EXTENSIONS.get(ext)
    if not mime or ext not in TEXTUAL_EXTS:
        raise HTTPException(status_code=415, detail="Unsupported file type")

    try:
        # write text (replace invalids if ever present in content)
        file_path.write_text(payload.content, encoding="utf-8", errors="strict")
    except BaseException as exc:
        raise HTTPException(
            status_code=500, detail="Failed to save file"
        ) from exc

    return MessageResponse(message="Saved")


@api.post(
    "/workspace/upload",
    response_model=PathItem,
    responses={
        "200": {"description": "The uploaded file"},
        "400": {"description": "Invalid request"},
        "404": {"description": "Error: Directory not found"},
        "500": {"description": "Failed to upload file"},
    },
)
async def upload_file(
    path: str = Form(default=""),
    file: UploadFile = File(...),
    root_dir: Path = Depends(get_root_directory),
) -> PathItem:
    """Upload a file in chunks.

    Parameters
    ----------
    path : str
        The directory path where the file will be uploaded.
    file : UploadFile
        The file to upload.
    root_dir : Path
        The root directory to use.

    Returns
    -------
    PathItem
        The uploaded file.

    Raises
    ------
    HTTPException
        If the file exceeds the maximum size,
        if the already exists or there is an upload error.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Error: Invalid file name")
    target_dir = check_path(
        path, root_dir=root_dir, must_exist=True, must_be_dir=True
    )
    full_path = target_dir / file.filename
    if full_path.exists():
        raise HTTPException(
            status_code=400, detail="Error: File already exists"
        )
    file_size = 0
    # pylint: disable=too-many-try-statements
    try:
        async with aiofiles.open(full_path, "wb") as f:
            while chunk := await file.read(CHUNK_SIZE):
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=400,
                        detail="Error: File exceeds maximum size",
                    )
                await f.write(chunk)
    except HTTPException as error:
        full_path.unlink(missing_ok=True)
        raise error
    except BaseException as error:
        full_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500, detail="Failed to upload file"
        ) from error

    return PathItem(
        name=full_path.name,
        path=safe_rel(full_path, root=root_dir),
        type="file",
    )


@api.get(
    "/workspace/download",
    responses={
        "200": {"description": "The file was downloaded"},
        "400": {"description": "Error: Invalid path"},
        "404": {"description": "Error: File or folder not found"},
        "500": {"description": "Failed to download file or folder"},
    },
)
async def download_file_or_folder(
    path: str,
    background_tasks: BackgroundTasks,
    root_dir: Path = Depends(get_root_directory),
) -> FileResponse:
    """Download a file or folder.

    Parameters
    ----------
    path : str
        The path to the file or folder to download.
    background_tasks : BackgroundTasks
        The background tasks to use for deleting temporary files.
    root_dir : Path
        The root directory to use.

    Returns
    -------
    FileResponse
        The file or folder to download.

    Raises
    ------
    HTTPException
        If the file or folder does not exist or the download fails.
    """
    # make a zip if folder
    target_path = check_path(
        path, root_dir=root_dir, must_exist=True, must_be_dir=False
    )
    if target_path.is_file():
        return FileResponse(target_path, filename=target_path.name)
    return await sync_to_async(download_zip_sync)(
        target_path, root_dir, background_tasks
    )


@api.get(
    "/workspace/get",
    responses={
        "200": {"description": "The file or folder was deleted"},
        "400": {"description": "Error: Invalid path"},
        "404": {"description": "Error: File or folder not found"},
        "415": {"description": "Error: Unsupported file type"},
        "500": {"description": "Failed to delete file or folder"},
    },
)
async def get_file(
    path: str,
    root_dir: Path = Depends(get_root_directory),
) -> Response:
    """Get a file.

    Parameters
    ----------
    path : str
        The path to the file to get
    root_dir : Path
        The root directory to use.

    Returns
    -------
    Response
        A response with the file contents or the file itself

    Raises
    ------
    HTTPException
        If the request is invalid.
    """
    try:
        file_path = check_path(
            path,
            root_dir,
            path_type="File",
            must_exist=True,
            must_be_file=True,
            must_be_dir=False,
        )
    except BaseException as exc:
        LOG.error("Error: %s", exc)
        raise HTTPException(status_code=404, detail="Invalid request") from exc

    ext = file_path.suffix.lower()
    mime = ALLOWED_EXTENSIONS.get(ext)
    if not mime:
        try:
            guessed = puremagic.from_file(str(file_path))
            ext = _norm_ext(guessed)
            mime = ALLOWED_EXTENSIONS.get(ext)
        except BaseException as exc:
            raise HTTPException(
                status_code=415, detail="Unsupported file type"
            ) from exc

    if not mime:
        raise HTTPException(status_code=415, detail="Unsupported file type")

    if ext in TEXTUAL_EXTS:
        content = file_path.read_text(encoding="utf-8", errors="replace")
        return ORJSONResponse(
            {
                "path": safe_rel(file_path, root=root_dir),
                "mime": mime,
                "content": content,
            }
        )
    file_name = file_path.name.encode(
        encoding="utf-8", errors="replace"
    ).decode(encoding="latin-1", errors="replace")
    headers = {"Content-Disposition": f'inline; filename="{file_name}"'}
    return FileResponse(
        file_path,
        filename=file_name,
        media_type=mime,
        headers=headers,
    )


@api.delete(
    "/workspace",
    response_model=MessageResponse,
    responses={
        "200": {"description": "The file or folder was deleted"},
        "400": {"description": "Error: Invalid path"},
        "404": {"description": "Error: File or folder not found"},
        "500": {"description": "Failed to delete file or folder"},
    },
)
async def delete_file_or_folder(
    path: str, root_dir: Path = Depends(get_root_directory)
) -> MessageResponse:
    """Delete a file or folder.

    Parameters
    ----------
    path : str
        The path to the file or folder to delete.
    root_dir : Path
        The root directory to use.

    Returns
    -------
    MessageResponse
        A success message.

    Raises
    ------
    HTTPException
        If the file or folder does not exist.
    """
    target_path = check_path(
        path, root_dir=root_dir, must_exist=True, must_be_dir=False
    )
    thing = "Folder" if target_path.is_dir() else "File"
    try:
        if target_path.is_dir():
            rmtree = sync_to_async(shutil.rmtree)
            # pylint: disable=line-too-long
            # fmt: off
            await rmtree(target_path, ignore_errors=True)  # type: ignore[unused-ignore,call-arg]  # noqa: E501
            # fmt: on
        else:
            await os.remove(target_path)
    except BaseException as error:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete {thing.lower()}"
        ) from error

    return MessageResponse(message=f"{thing} deleted successfully")


@api.get("/workspace/sqlite-tables")
async def sqlite_tables(
    path: str,
    root_dir: Path = Depends(get_root_directory),
) -> dict[str, Any]:
    """Get sqlite tables.

    Parameters
    ----------
    path : str
        The path to the sqlite db.
    root_dir : Path
        The root directory to use.

    Returns
    -------
    dict[str, Any]
        The tables in the db file.
    """
    file_path = check_path(path, root_dir, must_be_file=True)
    _ensure_sqlite(file_path)
    q = (
        "SELECT name FROM sqlite_master WHERE type='table' "
        "AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    async with aiosqlite.connect(f"file:{file_path}?mode=ro", uri=True) as db:
        async with db.execute(q) as cur:
            tables = [r[0] async for r in cur]
    return {"tables": tables}


@api.get("/workspace/sqlite-rows")
async def sqlite_rows(  # pylint: disable=too-many-locals
    path: str,
    table: str = Query(..., description="Table name (must exist)"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    order_by: str | None = Query(None, description="Column name to order by"),
    order_dir: str | None = Query(None, pattern="^(?i)(asc|desc)$"),
    search: str | None = Query(None, description="Simple substring filter"),
    root_dir: Path = Depends(get_root_directory),
) -> dict[str, Any]:
    """Get a table's rows.

    Parameters
    ----------
    path : str
        The path of the sqlite db file.
    table : str
        The table name.
    limit : int
        Optional limit for the number of rows. Defaults to 50
    offset : int
        Optional offset to use for fetching the rows. Defaults to 0
    order_by : str | None
        Optional ordering for the rows.
    order_dir : str
        Ordering direction (arc/desc).
    search : str
        Optional substring filter to search for.
    root_dir : Path
        The root directory to use.

    Returns
    -------
    dict[str, Any]
        The query results.

    Raises
    ------
    HTTPException
        If the table is not found.
    """
    file_path = check_path(path, root_dir, must_be_file=True)
    _ensure_sqlite(file_path)

    async with aiosqlite.connect(f"file:{file_path}?mode=ro", uri=True) as db:
        # verify table
        async with db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        ) as cur:
            if not await cur.fetchone():
                raise HTTPException(status_code=404, detail="Table not found")

        # columns + types
        async with db.execute(
            f"PRAGMA table_info({_quote_ident(table)})"
        ) as cur:
            info: list[aiosqlite.Row] = [row async for row in cur]
        columns: list[str] = [r[1] for r in info]
        types = {r[1]: (r[2] or "").upper() for r in info}  # name -> decl type

        # build WHERE for search (LIKE across text-ish columns)
        where_sql = ""
        where_args: list[object] = []
        if search:
            like = f"%{search}%"
            text_cols = [
                column
                for column in columns
                if "CHAR" in types[column]
                # cspell: disable-next-line
                or "CLOB" in types[column]
                or "TEXT" in types[column]
                or types[column] == ""
            ]
            if text_cols:
                clauses = [f"{_quote_ident(c)} LIKE ?" for c in text_cols]
                where_sql = "WHERE " + " OR ".join(clauses)
                where_args = [like] * len(text_cols)

        # order by (validate column)
        order_sql = ""
        if order_by and order_by in columns:
            dir_sql = "DESC" if (order_dir or "").lower() == "desc" else "ASC"
            order_sql = f"ORDER BY {_quote_ident(order_by)} {dir_sql}"

        # total
        q = (
            "SELECT COUNT(*) FROM "  # nosemgrep # nosec
            f"{_quote_ident(table)} {where_sql}"
        )
        async with db.execute(
            q,
            where_args,
        ) as cur:
            total: aiosqlite.Row | None = await cur.fetchone()

        # rows
        q = (
            f"SELECT * FROM {_quote_ident(table)} "  # nosemgrep # nosec
            f"{where_sql} {order_sql} LIMIT ? OFFSET ?"
        )
        async with db.execute(
            q,
            [*where_args, limit, offset],
        ) as cur:
            rows = [r async for r in cur]

    return {
        "table": table,
        "columns": columns,
        "rows": rows,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


async def create_new_path_item(
    full_path: Path, item_type: PathItemType, root_dir: Path
) -> PathItem:
    """Create a new file or folder.

    Parameters
    ----------
    full_path : Path
        The full path where the file or folder will be created.
    item_type : PathItemType
        The type of the item to create ("file" or "folder").
    root_dir : Path
        The root directory to use.

    Returns
    -------
    PathItem
        The newly created file or folder.
    Raises
    ------
    HTTPException
        If the item type is invalid or creation fails.
    """
    try:
        if item_type == "folder":
            full_path.mkdir(exist_ok=False)
        elif item_type == "file":
            async with aiofiles.open(full_path, mode="w") as f:
                await f.write('{"type": "flow"}')
    except BaseException as error:
        raise HTTPException(
            status_code=500, detail=f"Error: Failed to create {item_type}"
        ) from error
    return PathItem(
        name=full_path.name,
        path=safe_rel(full_path, root=root_dir),
        type=item_type,
    )


def download_zip_sync(
    target_path: Path, root_dir: Path, background_tasks: BackgroundTasks
) -> FileResponse:
    """Download a folder as a zip file.

    Parameters
    ----------
    target_path : Path
        The path to the folder to download.
    root_dir : Path
        The root directory to use.
    background_tasks : BackgroundTasks
        The background tasks to use for deleting temporary files.

    Returns
    -------
    FileResponse
        The zip file to download.

    Raises
    ------
    HTTPException
        If the download (archiving) fails.
    """
    # pylint: disable=too-many-try-statements
    try:
        # Create a temporary directory
        temp_dir = tempfile.mkdtemp()
        temp_dir_path = Path(temp_dir)
        zip_path = temp_dir_path / f"{target_path.name}.zip"

        # Create the archive
        archive = shutil.make_archive(
            base_name=str(zip_path.with_suffix("")),
            format="zip",
            root_dir=str(root_dir),
            base_dir=target_path.name,
        )

        # Add cleanup task for the temporary directory
        def cleanup() -> None:
            """Clean up the temporary directory."""
            shutil.rmtree(temp_dir, ignore_errors=True)

        background_tasks.add_task(cleanup)

        # Return the archive as a FileResponse
        return FileResponse(
            archive, filename=zip_path.name, background=background_tasks
        )

    except BaseException as error:
        raise HTTPException(
            status_code=500, detail="Error: Failed to download folder"
        ) from error


def _norm_ext(x: str) -> str:
    x = x.strip().lower()
    return x if x.startswith(".") else f".{x}"


def _ensure_sqlite(path: Path) -> None:
    if path.suffix.lower() not in SQLITE_EXTS:
        raise HTTPException(status_code=415, detail="Not a SQLite file")


def _quote_ident(name: str) -> str:
    # very simple quoting (escape double quotes)
    return '"' + name.replace('"', '""') + '"'
