"""Workspace API routes."""

import logging
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional

import aiofiles
import aiofiles.os
import aiofiles.tempfile
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
from fastapi.responses import FileResponse

from waldiez_studio.models import (
    MessageResponse,
    PathItem,
    PathItemCreateRequest,
    PathItemListResponse,
    PathItemRenameRequest,
    PathItemType,
)
from waldiez_studio.utils.sync import sync_to_async

from .common import (
    check_path,
    get_new_file_name,
    get_new_folder_name,
    get_root_directory,
)

api = APIRouter()
LOG = logging.getLogger(__name__)

CHUNK_SIZE = 1024 * 1024  # 1 MB chunks
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB maximum file size


@api.get("/workspace", response_model=PathItemListResponse)
async def list_items(
    parent: Optional[str] = Query(
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

    def sync_list_items(directory: Path) -> List[PathItem]:
        """List files and folders in a given directory.

        Parameters
        ----------
        directory : Path
            The directory to list.

        Returns
        -------
        List[PathItem]
            A list of files and folders in the specified directory.
        """
        items = [
            PathItem(
                name=item.name,
                path=str(item.relative_to(root_dir)),
                type="folder" if item.is_dir() else "file",
            )
            for item in directory.iterdir()
        ]
        return items

    entries = await sync_to_async(sync_list_items)(target_dir)
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
        path=str(new_target.relative_to(root_dir)),
        type="folder" if new_target.is_dir() else "file",
    )


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
    path: str = Form(...),
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
        path=str(full_path.relative_to(root_dir)),
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
            await aiofiles.os.remove(target_path)
    except BaseException as error:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete {thing.lower()}"
        ) from error

    return MessageResponse(message=f"{thing} deleted successfully")


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
        path=str(full_path.relative_to(root_dir)),
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
