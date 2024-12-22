"""Utilities for managing extra static files."""

# pylint: disable=broad-except, too-many-try-statements

import hashlib
import io
import json
import logging
import shutil
import sys
import tarfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, Tuple

import httpx
from packaging import version

LOG = logging.getLogger(__name__)

REGISTRY_BASE_URL = "https://registry.npmjs.org"
PACKAGE_NAME = "monaco-editor"
SWAGGER_DIST = (
    "https://raw.githubusercontent.com/swagger-api/swagger-ui/master/dist"
)
SWAGGER_FILEs = [
    "swagger-ui.css",
    "swagger-ui.css.map",
    "swagger-ui-bundle.js",
    "swagger-ui-bundle.js.map",
]
SWAGGER_ASSETS = [
    (
        file,
        "css" if file.endswith((".css", "css.map")) else "js",
        f"{SWAGGER_DIST}/{file}",
    )
    for file in SWAGGER_FILEs
]


class DownloadError(Exception):
    """Custom exception for download errors."""


def check_cached_details(file_path: Path) -> Optional[Tuple[str, str, str]]:
    """Check if the cached package details are recent.

    Parameters
    ----------
    file_path : Path
        The path to the file.

    Returns
    -------
    Optional[Tuple[str, str, str]]
        The cached package details if they are recent, None otherwise.
    """
    if not file_path.exists():
        return None
    # pylint: disable=broad-except
    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
    except BaseException as e:
        LOG.error("Error checking cached details: %s", e)
        return None
    try:
        last_check = datetime.fromisoformat(data.get("last_check", ""))
        version_ = data.get("version")
        url = data.get("url")
    except BaseException as e:
        LOG.error("Error parsing last check timestamp: %s", e)
        return None
    if not all((last_check, version_, url)):
        return None
    if datetime.now(timezone.utc) - last_check < timedelta(days=1):
        return version_, url, data.get("sha_sum")
    return None


async def get_package_details(static_root: Path) -> Tuple[str, str, str]:
    """Fetch details about the latest version of the monaco editor.

    Parameters
    ----------
    static_root : Path
        The root directory for storing package metadata.

    Returns
    -------
    Tuple[str, str, str]
        A tuple containing the latest version, tarball URL, and SHA-1 checksum.

    Raises
    ------
    DownloadError
        If fetching package details fails.
    """
    # let's merge loading and checking the file
    monaco_details = static_root / "monaco_details.json"
    cached = check_cached_details(monaco_details)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(f"{REGISTRY_BASE_URL}/{PACKAGE_NAME}")
            if response.status_code != 200:
                raise DownloadError(
                    f"Failed to fetch package details: {response.status_code}"
                )

            package_data = response.json()
            latest_version = package_data.get("dist-tags", {}).get("latest")
            version_info = package_data.get("versions", {}).get(latest_version)
            tarball_url = version_info.get("dist", {}).get("tarball")
            sha_sum = version_info.get("dist", {}).get("shasum")
            if not all((latest_version, tarball_url, sha_sum)):
                raise DownloadError("Package details are incomplete.")

            # Cache the details with a 'last_check' timestamp
            monaco_details.write_text(
                json.dumps(
                    {
                        "version": latest_version,
                        "url": tarball_url,
                        "sha_sum": sha_sum,
                        "last_check": datetime.now(timezone.utc).isoformat(),
                    },
                    indent=2,
                ),
                encoding="utf-8",
                newline="\n",
            )
            return latest_version, tarball_url, sha_sum
    except BaseException as e:
        raise DownloadError(f"Failed to fetch package details: {e}") from e


def extract_monaco_tar(tar_data: bytes, monaco_path: Path) -> None:
    """Extract the monaco editor tarball.

    Parameters
    ----------
    tar_data : bytes
        The tarball data.
    monaco_path : Path
        The path to the monaco editor files.

    Raises
    ------
    FileNotFoundError
        If the extraction fails.
    """
    monaco_path.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(tar_data)) as tar:
        if tar_has_filter_parameter():
            tar.extractall(monaco_path, filter="data")  # nosemgrep # nosec
        else:
            tar.extractall(monaco_path)  # nosemgrep # nosec
    monaco_editor_root = monaco_path / "package"
    vs_src = monaco_editor_root / "min" / "vs"
    if not vs_src.exists():
        raise FileNotFoundError("Failed to extract monaco editor files.")
    vs_dst = monaco_path / "vs"
    if vs_dst.exists():
        shutil.rmtree(vs_dst)
    shutil.move(vs_src, vs_dst)
    min_map_src = monaco_editor_root / "min-maps"
    if min_map_src.exists():
        min_map_dst = monaco_path / "min-maps"
        if min_map_dst.exists():
            shutil.rmtree(min_map_dst)
        shutil.move(min_map_src, min_map_dst)
    shutil.rmtree(monaco_editor_root)


async def download_monaco_editor(static_root: Path) -> None:
    """Download and extract the monaco editor files.

    Parameters
    ----------
    static_root : Path
        The root directory for the monaco editor files.

    Raises
    ------
    DownloadError
        If the download fails.

    ValueError
        If the SHA-1 checksum does not match the expected value.
    """
    monaco_path = static_root / "monaco"
    if monaco_path.exists() and (monaco_path / "vs" / "loader.js").exists():
        LOG.info("Monaco editor files are already present.")
        return

    details = await get_package_details(static_root)
    _version, url, sha_sum = details
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(url)
            if response.status_code != 200:
                raise DownloadError(
                    f"Failed to download Monaco Editor: {response.status_code}"
                )

            tar_data = response.content
    except BaseException as e:
        raise DownloadError(f"Failed to download Monaco Editor: {e}") from e

    calculated_sha_sum = hashlib.sha1(
        tar_data, usedforsecurity=False
    ).hexdigest()
    if calculated_sha_sum != sha_sum:
        raise ValueError("SHA-1 checksum mismatch.")
    try:
        extract_monaco_tar(tar_data, monaco_path)
    except BaseException as e:
        LOG.error("Failed to extract Monaco Editor files: %s", e)
        raise DownloadError("Failed to extract Monaco Editor files.") from e


async def download_swagger_assets(static_root: Path) -> None:
    """Download the Swagger UI assets.

    Parameters
    ----------
    static_root : Path
        The root directory for the Swagger UI files.

    Raises
    ------
    DownloadError
        If the download fails.
    """
    swagger_path = static_root / "swagger"
    swagger_path.mkdir(parents=True, exist_ok=True)
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            for asset, subdir, url in SWAGGER_ASSETS:
                (swagger_path / subdir).mkdir(parents=True, exist_ok=True)
                asset_path = swagger_path / subdir / asset
                if asset_path.exists():
                    continue

                response = await client.get(url)
                if response.status_code != 200:
                    LOG.error(
                        "Failed to download %s: %s", asset, response.status_code
                    )
                    raise DownloadError(
                        f"Failed to download {asset}: {response.status_code}"
                    )

                asset_path.write_text(
                    response.text, encoding="utf-8", newline="\n"
                )
    except BaseException as e:
        LOG.error("Failed to download Swagger UI assets: %s", e)
        raise DownloadError("Failed to download Swagger UI assets.") from e


async def ensure_extra_static_files(static_root: Path) -> None:
    """Ensure all required extra static files are present.

    Parameters
    ----------
    static_root : Path
        The root directory for all static files.

    Raises
    ------
    DownloadError
        If any download fails.
    """
    frontend_dir = static_root / "frontend"
    frontend_dir.mkdir(parents=True, exist_ok=True)
    if not (frontend_dir / "index.html").exists():
        (frontend_dir / "index.html").write_text(
            "The frontend files are not found. Please build the frontend first."
        )
    try:
        await download_monaco_editor(static_root)
        LOG.info("Monaco editor files are up-to-date.")
    except DownloadError as e:
        LOG.error("Error ensuring monaco editor files: %s", e)
        raise DownloadError("Failed to download Monaco Editor.") from e

    try:
        await download_swagger_assets(static_root)
        LOG.info("Swagger UI assets are up-to-date.")
    except BaseException as e:
        LOG.error("Error ensuring Swagger UI assets: %s", e)
        raise DownloadError("Failed to download Swagger UI assets.") from e


def tar_has_filter_parameter() -> bool:  # pragma: no cover
    """Check if the tarfile.extractall method has the filter parameter.

    Returns
    -------
    bool
        True if the filter parameter is available, False otherwise.
    """
    # Changed in version 3.10.12: Added the filter parameter.
    # Changed in version 3.11.4: Added the filter parameter.
    # Changed in version 3.12: Added the filter parameter.
    py_version = version.parse(sys.version.split()[0])
    if py_version.minor >= 12:
        return True
    if py_version.minor == 11 and py_version.micro >= 4:
        return True
    if py_version.minor == 10 and py_version.micro >= 12:
        return True
    return False
