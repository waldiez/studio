"""Common utilities for the api routes."""

import logging
import re
from pathlib import Path
from typing import Optional
from urllib.parse import unquote

from fastapi import Depends, HTTPException, Query

from waldiez_studio.utils.paths import get_root_dir

LOG = logging.getLogger(__name__)


def get_root_directory() -> Path:
    """Get the root directory of the workspace.

    Returns
    -------
    Path
        The root directory of the workspace.
    """
    return get_root_dir()


def _resolve_path(path: Path, strict: bool = False) -> Path:
    """Resolve a path and ensure it exists.

    Parameters
    ----------
    path : Path
        The path to resolve.
    strict : bool, optional
        Whether to strictly enforce the path, by default False.

    Returns
    -------
    Path
        The resolved path.

    Raises
    ------
    FileNotFoundError
        If the path does not exist.
    """
    try:
        resolved_path = path.resolve(strict=strict)
    except FileNotFoundError as error:
        raise FileNotFoundError("Error: Path not resolved") from error
    except BaseException as error:
        raise ValueError("Error: Path not resolved") from error
    return resolved_path


def sanitize_path(root_dir: Path, path: str, strict: bool = False) -> Path:
    """Sanitize a path and ensure it is within the root directory.

    Parameters
    ----------
    root_dir : Path
        The root directory to check against.
    path : str
        The path to sanitize.
    strict : bool, optional
        Whether to strictly enforce the path, by default False.

    Returns
    -------
    Path
        The sanitized path.

    Raises
    ------
    ValueError
        If the path is invalid or traverses outside the root directory.
    BaseException
        If the path cannot be resolved.
    """
    if path in ("/", ""):
        return root_dir
    try:
        unquoted_path = unquote(path, errors="strict")
        if not unquoted_path.strip():
            return root_dir
    except BaseException as error:
        raise ValueError("Error: Invalid path") from error
    if unquoted_path in ("/", ""):
        return root_dir
    # Reject paths with invalid characters
    if re.search(r"[<>:\"|?*]", unquoted_path):
        raise ValueError("Error: Invalid path")
    safe_path = root_dir / Path(unquoted_path.strip("/"))
    try:
        resolved_path = _resolve_path(safe_path, strict=strict)
    except BaseException as error:
        raise error
    if not resolved_path.is_relative_to(root_dir):
        raise ValueError("Error: Invalid path: Path is outside root directory")
    return resolved_path


def check_path(
    path: str,
    root_dir: Path,
    path_type: str = "Path",
    must_exist: bool = True,
    must_not_exist: bool = False,
    must_be_dir: bool = False,
    must_be_file: bool = False,
    must_have_extension: Optional[str] = None,
) -> Path:
    """Reusable dependency for sanitizing paths.

    Parameters
    ----------
    path : str
        The path to sanitize.
    root_dir : Path
        The root directory to use.
    path_type : str, optional
        The type of path, by default "Path" ("Path", "File" or "Directory").
    must_exist : bool, optional
        Whether the path must exist, by default True.
    must_not_exist : bool, optional
        Whether the path must not exist, by default False.
    must_be_dir : bool, optional
        Whether the path must be a directory, by default False.
    must_be_file : bool, optional
        Whether the path must be a file, by default False.
    must_have_extension : Optional[str], optional
        The extension the path must have, by default None.

    Returns
    -------
    Path
        The sanitized path.

    Raises
    ------
    HTTPException
        If the path is invalid.
    """
    thing = "File" if must_be_file else "Directory" if must_be_dir else "Path"
    try:
        the_path = sanitize_path(root_dir, path, must_exist)
    except FileNotFoundError as error:
        LOG.warning("Invalid path: %s, %s, %s", path, root_dir, error)
        raise HTTPException(
            status_code=404, detail=f"Error: {thing} not found"
        ) from error
    except ValueError as error:
        LOG.warning("Invalid path: %s, %s, %s", path, root_dir, error)
        raise HTTPException(
            status_code=400, detail=f"Error: Invalid {path_type.lower()}"
        ) from error
    thing = (
        _guess_path_type(must_be_dir, must_be_file, the_path)
        if path_type == "Path"
        else path_type
    )
    if must_exist and not the_path.exists():
        raise HTTPException(status_code=404, detail=f"Error: {thing} not found")
    if must_not_exist and the_path.exists():
        raise HTTPException(
            status_code=400, detail=f"Error: {thing} already exists"
        )
    if must_be_dir and not the_path.is_dir():
        raise HTTPException(status_code=400, detail="Error: Not a directory")
    if must_be_file and not the_path.is_file():
        raise HTTPException(status_code=400, detail="Error: Not a file")
    if must_have_extension and the_path.suffix != must_have_extension:
        raise HTTPException(status_code=400, detail="Error: Invalid file type")
    return the_path.resolve(must_exist)


def _guess_path_type(
    should_be_dir: bool, should_be_file: bool, path: Path
) -> str:
    """Get the path type for error messages.

    Parameters
    ----------
    should_be_dir : bool
        Whether the path is expected to be a directory.
    should_be_file : bool
        Whether the path is expected to be a file.
    path : Path
        The path to check.

    Returns
    -------
    str
        The path type.
    """
    if should_be_dir:
        return "Directory"
    if should_be_file:
        return "File"
    if path.is_dir():
        return "Directory"
    if path.is_file():
        return "File"
    return "Path"


def get_new_folder_name(root_dir: Path, folder_name: str) -> str:
    """Get a new folder name that does not already exist.

    Parameters
    ----------
    root_dir : Path
        The root directory to check for existing folders.
    folder_name : str
        The original folder name.

    Returns
    -------
    str
        The new folder name.
    """
    # add (n) to the folder name if it already exists
    n = 0
    new_folder_name = folder_name
    while (root_dir / new_folder_name).exists():
        n += 1
        new_folder_name = f"{folder_name} ({n})"
    return new_folder_name


def get_new_file_name(root_dir: Path, file_name: str) -> str:
    """Get a new file name that does not already exist.

    Parameters
    ----------
    root_dir : Path
        The root directory to check for existing files.
    file_name : str
        The original file name.

    Returns
    -------
    str
        The new file name.
    """
    # add (n) to the file name if it already exists
    n = 0
    new_file_name = file_name
    while (root_dir / new_file_name).exists():
        n += 1
        parts = file_name.rsplit(".", maxsplit=1)
        if len(parts) == 2:
            new_file_name = f"{parts[0]} ({n}).{parts[1]}"
        else:
            new_file_name = f"{file_name} ({n})"
    return new_file_name


def check_flow_path(
    path: str = Query(..., description="The path to the flow."),
    root_dir: Path = Depends(get_root_directory),
) -> Path:
    """Validate the flow path.

    Parameters
    ----------
    path : str
        The path to the flow.
    root_dir : Path
        The root directory of the workspace.

    Returns
    -------
    Path
        The validated flow path relative to the root directory.
    Raises
    ------
    HTTPException
        If the path is invalid, the file does not exist,
        the file is not a file, or the file type is invalid.
    """
    return check_path(
        path,
        root_dir,
        path_type="File",
        must_exist=True,
        must_be_file=True,
        must_be_dir=False,
        must_have_extension=".waldiez",
    )
