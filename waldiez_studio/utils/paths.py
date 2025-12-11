# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# pylint: disable=broad-exception-caught,too-many-try-statements
# pyright: reportUnknownMemberType=false

"""Directories to use for user uploads and flow outputs."""

import base64
import builtins
import getpass
import os
import sys
from functools import lru_cache
from pathlib import Path


@lru_cache
def is_frozen() -> bool:
    """Check if we are inside a compiled app.

    Returns
    -------
    bool
        True if detected frozen.
    """
    try:
        compiled = getattr(builtins, "__compiled__", False)
    except Exception:
        compiled = False

    return bool(
        getattr(sys, "frozen", False)  # PyInstaller, cx_Freeze
        or hasattr(sys, "_MEIPASS")  # PyInstaller
        or compiled  # Nuitka/Cython
    )


@lru_cache
def is_installed_package() -> bool:
    """Check if running from an installed package (not editable/dev mode).

    Returns
    -------
    bool
        True if detected as installed, False otherwise.
    """
    try:
        # Check if running from site-packages
        module_path = Path(__file__).resolve()
        site_packages = any("site-packages" in str(p) for p in sys.path)
        return site_packages and "site-packages" in str(module_path)
    except Exception:
        return False


@lru_cache
def get_root_dir(user_id: str | None = None) -> Path:
    """Get the root directory for flows, user uploads, etc.

    Parameters
    ----------
    user_id : str | None
        The user ID (if using multi-user mode, else, the current user).

    Returns
    -------
    Path
        The root waldiez directory
    """
    if not user_id:
        user_id = getpass.getuser()
    if is_frozen() or is_installed_package():  # pragma: no cover
        root_dir = Path.home()
        # if current user is "waldiez", let's skip dupe
        if root_dir.name.lower() != "waldiez":
            root_dir = root_dir / "waldiez"
        root_dir.mkdir(parents=True, exist_ok=True)
        return root_dir
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
    return base64.urlsafe_b64encode(path.as_posix().encode()).decode()


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
    return Path(base64.urlsafe_b64decode(identifier).decode())
