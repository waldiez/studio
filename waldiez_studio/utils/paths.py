# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# pylint: disable=broad-exception-caught,too-many-try-statements
# pyright: reportUnknownMemberType=false

"""Directories to use for user uploads and flow outputs."""

import base64
import builtins
import getpass
import json
import os
import re
import shutil
import sys
from functools import lru_cache
from pathlib import Path

BASE_URL = "base_url.txt"
API_PREFIXES = "api_prefixes.json"


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


def _get_last_base_url(static_root: Path) -> str | None:
    base_url_path = static_root / BASE_URL
    if not base_url_path.exists():
        return None
    if base_url_path.is_dir():
        shutil.rmtree(base_url_path)
    try:
        with open(base_url_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except BaseException:
        try:
            base_url_path.unlink(missing_ok=True)
        except BaseException:
            pass
    return None


def _store_last_base_url(static_root: Path, base_url: str) -> None:
    base_url_path = static_root / BASE_URL
    try:
        with open(base_url_path, "w", encoding="utf-8") as f:
            f.write(base_url)
    except BaseException:
        pass


def _revert(
    static_root: Path, revert_pattern: str, extensions: set[str]
) -> int:
    reverted = 0
    for filepath in static_root.rglob("*"):
        if filepath.is_file() and filepath.suffix in extensions:
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()

                # Revert previous base_url to plain /frontend/
                reverted_content = content.replace(revert_pattern, "/frontend/")

                if reverted_content != content:
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(reverted_content)
                    reverted += 1
            except Exception as e:
                print(f"Error processing {filepath}: {e}")
    return reverted


def _replace(
    static_root: Path,
    old_pattern: str | re.Pattern[str],
    new_pattern: str,
    extensions: set[str],
) -> int:
    replaced = 0
    for filepath in static_root.rglob("*"):
        if filepath.is_file() and filepath.suffix in extensions:
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()

                new_content = re.sub(old_pattern, new_pattern, content)

                if new_content != content:
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    replaced += 1
                    print(f"Modified: {filepath}")
            except Exception as e:
                print(f"Error processing {filepath}: {e}")
    return replaced


def replace_frontend_paths(static_root: Path, base_url: str) -> None:
    """Replace /frontend/ with {BASE_URL}/frontend/ in static files.

    Parameters
    ----------
    static_root : Path
        The path to frontend files.
    base_url : str
        The base url to use.
    """
    extensions = {".html", ".js", ".xml", ".webmanifest"}
    if not static_root.exists():
        print(f"Warning: Static directory {static_root} does not exist")
        return
    if base_url.endswith("/"):
        base_url = base_url[:-1]
    if base_url in (
        "./",
        "/",
        "/frontend/",
        "frontend/",
        "/frontend",
        "frontend",
    ):
        base_url = ""
    previous_base_url = _get_last_base_url(static_root)
    modified = 0

    # If base_url hasn't changed, skip processing
    if previous_base_url == base_url:
        return

    if previous_base_url:
        escaped_previous = re.escape(previous_base_url)
        revert_pattern = f"{escaped_previous}/frontend/"
        _revert(
            static_root, revert_pattern=revert_pattern, extensions=extensions
        )
    if base_url:
        new_pattern = f"{base_url}/frontend/"
        escaped_base_url = re.escape(base_url)
        old_pattern = f"(?<!{escaped_base_url})/frontend/"
        modified = _replace(
            static_root,
            old_pattern=old_pattern,
            new_pattern=new_pattern,
            extensions=extensions,
        )
        _store_last_base_url(static_root=static_root, base_url=base_url)
    else:
        _store_last_base_url(static_root=static_root, base_url="/")
    if modified:
        files = "files" if modified != 1 else "file"
        print(
            f"Frontend path replacement complete: {modified} {files} modified"
        )


def _load_previous_prefixes(static_root: Path) -> dict[str, str]:
    prefix_file = static_root / API_PREFIXES
    previous = {
        "api": "__WALDIEZ_STUDIO_API__/api",
        "ws": "__WALDIEZ_STUDIO_WS__/ws",
        "vs": "__WALDIEZ_STUDIO_VS__/vs",
    }
    if not prefix_file.exists():
        return previous
    try:
        previous_dict = json.loads(prefix_file.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Warning: Could not read previous prefixes: {e}")
        return previous
    if not isinstance(previous_dict, dict):
        return previous
    return {
        "api": previous_dict.get("api", previous["api"]),
        "ws": previous_dict.get("ws", previous["ws"]),
        "vs": previous_dict.get("vs", previous["vs"]),
    }


def _store_last_prefixes(static_root: Path, prefixes: dict[str, str]) -> None:
    prefix_file = static_root / API_PREFIXES
    try:
        prefix_file.write_text(json.dumps(prefixes), encoding="utf-8")
    except Exception as e:
        print(f"Warning: Could not store prefixes: {e}")


def _replace_prefixes(
    static_root: Path, previous: dict[str, str], current: dict[str, str]
) -> int:
    modified = 0
    api_prefix = current["api"]
    ws_prefix = current["ws"]
    vs_prefix = current["vs"]
    for filepath in static_root.rglob("*.js"):
        if filepath.is_file():
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()

                new_content = content

                # First, revert previous values back to placeholders
                # Handle both double and single quotes
                for key, placeholder in [
                    ("api", "__WALDIEZ_STUDIO_API__/api"),
                    ("ws", "__WALDIEZ_STUDIO_WS__/ws"),
                    ("vs", "__WALDIEZ_STUDIO_VS__/vs"),
                ]:
                    prev_value = previous[key]
                    new_content = new_content.replace(
                        f'"{prev_value}"', f'"{placeholder}"'
                    )
                    new_content = new_content.replace(
                        f"'{prev_value}'", f"'{placeholder}'"
                    )

                new_content = new_content.replace(
                    '"__WALDIEZ_STUDIO_API__/api"', f'"{api_prefix}"'
                )
                new_content = new_content.replace(
                    "'__WALDIEZ_STUDIO_API__/api'", f"'{api_prefix}'"
                )
                new_content = new_content.replace(
                    '"__WALDIEZ_STUDIO_WS__/ws"', f'"{ws_prefix}"'
                )
                new_content = new_content.replace(
                    "'__WALDIEZ_STUDIO_WS__/ws'", f"'{ws_prefix}'"
                )
                new_content = new_content.replace(
                    "'__WALDIEZ_STUDIO_VS__/vs'", f"'{vs_prefix}'"
                )
                new_content = new_content.replace(
                    '"__WALDIEZ_STUDIO_VS__/vs"', f'"{vs_prefix}"'
                )

                if new_content != content:
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    modified += 1

            except Exception:  # pylint: disable=broad-exception-caught
                pass
    return modified


def replace_api_prefixes(
    static_root: Path,
    base_url: str,
) -> None:
    """Replace API prefix placeholders in built JS files.

    prefixes:

    api_prefix : str
        The API prefix to use (e.g., "/api" or "/studio/api").
    ws_prefix : str
        The WebSocket prefix to use (e.g., "/ws" or "/studio/ws").
    vs_prefix : str
        The VS path to use (e.g., "/vs" or "/studio/vs").

    Parameters
    ----------
    static_root : Path
        The path to frontend files.
    base_url : str
        The base url to use for the prefixes
    """
    if not static_root.exists():
        return
    if base_url.endswith("/"):
        base_url = base_url[:-1]
    api_prefix = f"{base_url}/api"
    ws_prefix = f"{base_url}/ws"
    vs_prefix = f"{base_url}/vs"
    # Track previous values
    current = {"api": api_prefix, "ws": ws_prefix, "vs": vs_prefix}
    previous = _load_previous_prefixes(static_root)
    # If nothing changed, skip processing
    if previous == current:
        return
    modified = _replace_prefixes(
        static_root, previous=previous, current=current
    )
    # Store current values for next time
    _store_last_prefixes(static_root, prefixes=current)
    if modified:
        files = "files" if modified != 1 else "file"
        print(f"API prefix replacement complete: {modified} {files} modified")
