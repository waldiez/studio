"""Ensure extra static files (for monaco editor) are present.

We can serve these files from the Jupyter server or not.
The option is available on the plugin configuration page.
The default is to do serve them. If not, the files are served
from the default CDN that monaco loader uses.
"""

import hashlib
import io
import json
import logging
import os
import shutil
import tarfile
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Tuple, Union

import urllib3

REGISTRY_BASE_URL = "https://registry.npmjs.org"
PACKAGE_NAME = "monaco-editor"
LOG = logging.getLogger(__name__)

# pylint: disable=broad-except


def ensure_extra_static_files(static_root_path: Union[str, Path]) -> None:
    """Ensure extra static files are present.

    Parameters
    ----------
    static_root_path : Union[str, Path]
        The path to the static files directory

    Raises
    ------
    RuntimeError
        If the monaco editor files are not found.
    """
    if not isinstance(static_root_path, Path):
        static_root_path = Path(static_root_path)
    static_root_path.mkdir(parents=True, exist_ok=True)
    try:
        details = _get_package_details(static_root_path)
    except BaseException as error:
        LOG.error("Failed to get the latest version of monaco: %s", error)
        return
    version_file = static_root_path / "monaco_latest_version"
    if version_file.exists():
        with open(version_file, "r", encoding="utf-8") as file:
            current_version = file.read()
    else:
        current_version = None
    loader_js = static_root_path / "vs" / "loader.js"
    if current_version != details[0] or not loader_js.exists():
        LOG.info("Downloading monaco editor files...")
        try:
            _download_monaco_editor(details, static_root_path)
        except BaseException as error:
            LOG.error("Failed to download monaco editor files: %s", error)
            return
        with open(version_file, "w", encoding="utf-8") as file:
            file.write(details[0])
    if not loader_js.exists():
        LOG.error("Monaco editor files not found.")
        LOG.error("Path: %s", static_root_path)
        LOG.error("Files: %s", os.listdir(static_root_path))
        LOG.error("vs folder: %s", os.listdir(static_root_path / "vs"))
        raise RuntimeError("Failed to download monaco editor files.")
    LOG.info("Monaco editor files are up-to-date.")


def _get_stored_package_details(
    static_root_path: Path,
) -> Optional[Tuple[str, str, str]]:
    """Get the stored package details.

    Parameters
    ----------
    static_root_path : Path
        The path to the static files directory.

    Returns
    -------
    Optional[Tuple[str, str, str]]
        The stored version, download url, and SHA-1 sum.
    """
    last_check_file = static_root_path / "monaco_last_check.json"
    data: Dict[str, str] = {}
    if last_check_file.exists():
        try:
            with open(last_check_file, "r", encoding="utf-8") as file:
                data = json.load(file)
        except BaseException as error:
            LOG.error("Failed to load the last check file: %s", error)
            return None
    version = data.get("version", "")
    url = data.get("url", "")
    sha_sum = data.get("sha_sum", "")
    last_check = data.get("last_check", "")
    if not version or not url or not sha_sum or not last_check:
        return None
    try:
        last_check_dt = datetime.fromisoformat(last_check)
    except BaseException as error:
        LOG.error("Failed to parse the last check date: %s", error)
        return None
    if (datetime.now() - last_check_dt).days >= 1:
        return None
    return version, url, sha_sum


def _get_package_details(static_root_path: Path) -> Tuple[str, str, str]:
    """Get details about the latest version of monaco editor.

    Returns
    -------
    Tuple[str, str, str]
        The latest version, download url, and SHA-1 sum.
    """
    stored_details = _get_stored_package_details(static_root_path)
    if stored_details:
        return stored_details
    timeout = urllib3.Timeout(connect=10.0, read=10.0, total=20.0)
    retry = urllib3.Retry(3, redirect=3, backoff_factor=0.3)
    http = urllib3.PoolManager(
        timeout=timeout,
        retries=retry,
    )
    response = http.request("GET", f"{REGISTRY_BASE_URL}/{PACKAGE_NAME}")
    data = json.loads(response.data)
    latest_version = data["dist-tags"]["latest"]
    latest_version_data = data["versions"][latest_version]
    url = latest_version_data["dist"]["tarball"]
    sha_sum = latest_version_data["dist"]["shasum"]
    last_check_file = static_root_path / "monaco_last_check.json"
    with open(last_check_file, "w", encoding="utf-8") as file:
        json.dump(
            {
                "version": latest_version,
                "url": url,
                "sha_sum": sha_sum,
                "last_check": datetime.now().isoformat(),
            },
            file,
            indent=2,
        )
    return latest_version, url, sha_sum


def _download_monaco_editor(
    details: Tuple[str, str, str],
    static_root_path: Union[str, Path],
) -> None:
    """Download and extract the monaco editor files.

    Parameters
    ----------
    details : Tuple[str, str, str]
        The version, download url, and SHA-1 sum.

    static_root_path : Union[str, Path]
        The path to the static files directory.
    """
    if not isinstance(static_root_path, Path):
        static_root_path = Path(static_root_path)
    timeout = urllib3.Timeout(connect=10.0, read=300.0, total=600.0)
    retry = urllib3.Retry(3, redirect=3, backoff_factor=0.3)
    http = urllib3.PoolManager(
        timeout=timeout,
        retries=retry,
    )
    version_url, version_sha_sum = details[1], details[2]
    response = http.request("GET", version_url)
    sha_sum = hashlib.sha1(response.data, usedforsecurity=False).hexdigest()
    if sha_sum != version_sha_sum:
        raise ValueError("SHA-1 sum mismatch.")
    os.makedirs(static_root_path, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(response.data)) as tar:
        tar.extractall(static_root_path)  # nosemgrep # nosec
    monaco_editor_path = os.path.join(static_root_path, "package")
    min_vs_src_dir = os.path.join(monaco_editor_path, "min", "vs")
    if not os.path.exists(min_vs_src_dir):
        raise FileNotFoundError("Failed to extract monaco editor files.")
    min_vs_dst_dir = os.path.join(static_root_path, "vs")
    if os.path.exists(min_vs_dst_dir):
        shutil.rmtree(min_vs_dst_dir)
    shutil.move(min_vs_src_dir, static_root_path)
    min_maps_vs_src_dir = os.path.join(monaco_editor_path, "min-maps", "vs")
    if not os.path.exists(min_maps_vs_src_dir):
        raise FileNotFoundError("Failed to extract monaco editor files.")
    min_maps_vs_dst_dir = os.path.join(static_root_path, "min-maps", "vs")
    if os.path.exists(min_maps_vs_dst_dir):
        shutil.rmtree(min_maps_vs_dst_dir)
    os.makedirs(os.path.join(static_root_path, "min-maps"), exist_ok=True)
    shutil.move(min_maps_vs_src_dir, os.path.join(static_root_path, "min-maps"))
    shutil.rmtree(monaco_editor_path)
