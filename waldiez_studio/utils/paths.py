"""Directories to use for user uploads and flow outputs."""

import os
from functools import lru_cache
from pathlib import Path


@lru_cache
def get_root_dir(user_id: str = "default") -> Path:
    """Get the root directory for flows, user uploads, etc.

    Parameters
    ----------
    user_id : str
        The user ID (if using multi-user mode)

    Returns
    -------
    Path
        The root waldiez directory
    """
    files_root = Path(__file__).parent.parent / "files"
    root_dir = files_root / user_id
    is_testing = (
        os.environ.get("WALDIEZ_STUDIO_TESTING", "False").lower() == "true"
    )
    if is_testing:
        root_dir = (
            Path(os.environ.get("WALDIEZ_STUDIO_ROOT_DIR", str(files_root)))
            / user_id
        )
    root_dir.mkdir(parents=True, exist_ok=True)
    return root_dir.resolve(True)


def get_static_dir() -> Path:
    """Get the static directory.

    Returns
    -------
    Path
        The static directory
    """
    root_dir = Path(__file__).parent.parent / "static"
    is_testing = (
        os.environ.get("WALDIEZ_STUDIO_TESTING", "False").lower() == "true"
    )
    if is_testing:
        root_dir = Path(
            os.environ.get("WALDIEZ_STUDIO_ROOT_DIR", str(root_dir))
        )
    return root_dir


def path_to_id(path: Path) -> str:
    """Convert a Path object to a Base64-encoded string identifier.

    Parameters
    ----------
    path : Path
        The Path object to convert.

    Returns
    -------
    str
        Base64-encoded string identifier.
    """
    return path.as_posix().encode("utf-8").hex()


def id_to_path(identifier: str) -> Path:
    """Convert a Base64-encoded string identifier back to a Path object.

    Parameters
    ----------
    identifier : str
        The Base64-encoded string identifier.

    Returns
    -------
    Path
        Reconstructed Path object.
    """
    return Path(bytes.fromhex(identifier).decode("utf-8"))
