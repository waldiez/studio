# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Tests for extra static file utilities."""

# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,missing-yield-doc,missing-param-doc,missing-raises-doc,line-too-long,unused-argument
import hashlib
import io
import json
import logging
import os
import shutil
import tarfile
from collections.abc import Generator
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
import pytest
import pytest_httpx

from waldiez_studio.utils.extra_static import (
    DownloadError,
    check_cached_details,
    download_monaco_editor,
    download_swagger_assets,
    ensure_extra_static_files,
    get_package_details,
)


@pytest.fixture(name="root_dir")
def root_dir_fixture(tmp_path: Path) -> Generator[Path, None, None]:
    """Get the temporary root directory.

    Parameters
    ----------
    tmp_path : Path
        Temporary path fixture.

    Yields
    ------
    Generator[Path, None, None]
        Temporary path generator.
    """
    os.environ["WALDIEZ_STUDIO_ROOT_DIR"] = str(tmp_path)
    yield tmp_path
    del os.environ["WALDIEZ_STUDIO_ROOT_DIR"]


@pytest.fixture(name="static_root")
def static_root_fixture(root_dir: Path) -> Generator[Path, None, None]:
    """Fixture for using a temporary static root directory.

    Parameters
    ----------
    root_dir : Path
        Temporary path fixture.

    Yields
    ------
    Generator[Path, None, None]
        Temporary path generator.
    """
    static_root = root_dir / "static"
    static_root.mkdir(parents=True, exist_ok=True)
    yield static_root
    shutil.rmtree(static_root)


@pytest.fixture(name="registry_response")
def registry_response_fixture() -> dict[str, Any]:
    """Mock response for the npm registry API."""
    return {
        "dist-tags": {"latest": "1.2.3"},
        "versions": {
            "1.2.3": {
                "dist": {
                    "tarball": "https://mock-tarball-url.com/monaco.tar.gz",
                    "shasum": hashlib.sha1(
                        b"mock-tarball-content", usedforsecurity=False
                    ).hexdigest(),
                }
            }
        },
    }


def mock_swagger_assets(
    httpx_mock: pytest_httpx.HTTPXMock, status_code: int, is_optional: bool
) -> None:
    """Mock Swagger UI assets responses."""
    for url in (
        "swagger-ui.css",
        "swagger-ui.css.map",
        "swagger-ui-bundle.js",
        "swagger-ui-bundle.js.map",
    ):
        httpx_mock.add_response(
            url=f"https://raw.githubusercontent.com/swagger-api/swagger-ui/master/dist/{url}",
            method="GET",
            status_code=status_code,
            content=b"mock-swagger-content",
            is_optional=is_optional,
        )


def mock_monaco_tarball(
    httpx_mock: pytest_httpx.HTTPXMock,
    registry_response: dict[str, Any],
    valid_tarball: bool = True,
    valid_checksum: bool = True,
    tarball_status_code: int = 200,
) -> None:
    """Mock Monaco tarball download."""
    if valid_tarball:
        tar_buffer = io.BytesIO()
        with tarfile.open(fileobj=tar_buffer, mode="w") as tar:
            tarinfo = tarfile.TarInfo(name="package/min/vs/loader.js")
            tarinfo.size = len(b"console.log('Mock loader');")
            tar.addfile(tarinfo, io.BytesIO(b"console.log('Mock loader');"))
            min_maps = tarfile.TarInfo(
                name="package/min-maps/vs/base/worker/workerMain.js.map"
            )
            min_maps.size = len(b"console.log('Mock map');")
            tar.addfile(min_maps, io.BytesIO(b"console.log('Mock map');"))
        tar_buffer.seek(0)
        tarball_content = tar_buffer.read()

    else:
        tarball_content = b"invalid tarball content"

    if valid_checksum:
        tarball_sha1 = hashlib.sha1(
            tarball_content, usedforsecurity=False
        ).hexdigest()
    else:
        tarball_sha1 = "invalid_checksum"

    registry_response["versions"]["1.2.3"]["dist"]["shasum"] = tarball_sha1

    # Mock the package details request
    httpx_mock.add_response(
        url="https://registry.npmjs.org/monaco-editor",
        method="GET",
        json=registry_response,
    )
    # Mock the tarball download
    httpx_mock.add_response(
        url="https://mock-tarball-url.com/monaco.tar.gz",
        method="GET",
        content=tarball_content,
        status_code=tarball_status_code,
    )


@pytest.mark.asyncio
async def test_download_monaco_editor(
    static_root: Path,
    httpx_mock: pytest_httpx.HTTPXMock,
    registry_response: dict[str, Any],
) -> None:
    """Test downloading and extracting the monaco editor."""
    mock_monaco_tarball(httpx_mock, registry_response)

    await download_monaco_editor(static_root)

    # Ensure the files were extracted
    assert (static_root / "monaco" / "vs" / "loader.js").exists()


@pytest.mark.asyncio
async def test_ensure_extra_static_files(
    httpx_mock: pytest_httpx.HTTPXMock,
    static_root: Path,
    registry_response: dict[str, Any],
) -> None:
    """Test ensuring that extra static files are downloaded."""
    # Create a valid tar archive in memory
    mock_monaco_tarball(httpx_mock, registry_response)
    # Mock Swagger UI assets download
    mock_swagger_assets(httpx_mock, 200, is_optional=False)
    await ensure_extra_static_files(static_root)

    # Check for Monaco Editor files
    assert (static_root / "monaco" / "vs" / "loader.js").exists()
    # Check for Swagger UI assets
    assert (static_root / "swagger" / "css" / "swagger-ui.css").exists()
    assert (static_root / "swagger" / "js" / "swagger-ui-bundle.js").exists()


@pytest.mark.asyncio
async def test_download_monaco_editor_existing_files(
    static_root: Path,
) -> None:
    """Test when Monaco editor files are already present."""
    # Create the necessary file structure
    monaco_loader = static_root / "monaco" / "vs" / "loader.js"
    monaco_loader.parent.mkdir(parents=True, exist_ok=True)
    monaco_loader.write_text("console.log('Mock loader');")

    await download_monaco_editor(static_root)


@pytest.mark.asyncio
async def test_get_package_details_error(
    httpx_mock: pytest_httpx.HTTPXMock, static_root: Path
) -> None:
    """Test for a DownloadError in get_package_details."""
    # Mock a failed response from the registry
    httpx_mock.add_response(
        url="https://registry.npmjs.org/monaco-editor",
        method="GET",
        status_code=500,
    )

    with pytest.raises(DownloadError):
        await get_package_details(static_root)


@pytest.mark.asyncio
async def test_download_monaco_editor_checksum_error(
    httpx_mock: pytest_httpx.HTTPXMock,
    static_root: Path,
    registry_response: dict[str, Any],
) -> None:
    """Test for a checksum mismatch in download_monaco_editor."""
    mock_monaco_tarball(httpx_mock, registry_response, valid_checksum=False)

    with pytest.raises(ValueError):
        await download_monaco_editor(static_root)


@pytest.mark.asyncio
async def test_download_monaco_editor_download_error(
    httpx_mock: pytest_httpx.HTTPXMock,
    static_root: Path,
    registry_response: dict[str, Any],
) -> None:
    """Test for a DownloadError when tarball download fails."""

    mock_monaco_tarball(httpx_mock, registry_response, tarball_status_code=404)

    with pytest.raises(DownloadError):
        await download_monaco_editor(static_root)


@pytest.mark.asyncio
async def test_ensure_extra_static_files_error_handling(
    httpx_mock: pytest_httpx.HTTPXMock,
    static_root: Path,
) -> None:
    """Test exception handling in ensure_extra_static_files."""
    httpx_mock.add_response(
        url="https://registry.npmjs.org/monaco-editor",
        method="GET",
        status_code=500,
    )
    with pytest.raises(DownloadError):
        await ensure_extra_static_files(static_root)


@pytest.mark.asyncio
async def test_get_package_details_missing_fields(
    httpx_mock: pytest_httpx.HTTPXMock, static_root: Path
) -> None:
    """Test get_package_details with missing fields."""
    httpx_mock.add_response(
        url="https://registry.npmjs.org/monaco-editor",
        method="GET",
        json={
            "dist-tags": {"latest": "1.2.3"},
            "versions": {
                "1.2.3": {"dist": {}},  # Missing tarball and shasum
            },
        },
    )
    with pytest.raises(DownloadError):
        await get_package_details(static_root)


@pytest.mark.asyncio
async def test_check_cached_details_file_not_found(
    static_root: Path,
) -> None:
    """Test check_cached_details when the cache file does not exist."""
    non_existent_file = static_root / "nonexistent.json"
    result = check_cached_details(non_existent_file)
    assert result is None


@pytest.mark.asyncio
async def test_check_cached_details_invalid_json(
    static_root: Path,
) -> None:
    """Test check_cached_details with invalid JSON in the cache file."""
    invalid_file = static_root / "invalid.json"
    invalid_file.write_text("{invalid json", encoding="utf-8")
    result = check_cached_details(invalid_file)
    assert result is None


@pytest.mark.asyncio
async def test_check_cached_details_stale_cache(static_root: Path) -> None:
    """Test check_cached_details with a stale cache."""
    stale_file = static_root / "stale.json"
    stale_file.write_text(
        json.dumps(
            {
                "version": "1.2.3",
                "url": "https://example.com",
                "sha_sum": "123abc",
                "last_check": (
                    datetime.now(timezone.utc) - timedelta(days=2)
                ).isoformat(),
            }
        ),
        encoding="utf-8",
    )
    result = check_cached_details(stale_file)
    assert result is None


@pytest.mark.asyncio
async def test_get_package_details_network_error(
    httpx_mock: pytest_httpx.HTTPXMock, static_root: Path
) -> None:
    """Test get_package_details handling network errors."""
    httpx_mock.add_exception(
        url="https://registry.npmjs.org/monaco-editor",
        method="GET",
        exception=httpx.ConnectError("Network error"),
    )
    with pytest.raises(DownloadError):
        await get_package_details(static_root)


@pytest.mark.asyncio
async def test_check_cached_details_read_error(
    static_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Test check_cached_details when file reading fails."""
    invalid_file = static_root / "read_error.json"
    invalid_file.write_text(json.dumps({"version": "1.2.3"}), encoding="utf-8")

    # noinspection PyUnusedLocal
    def mock_read_text(*args: Any, **kwargs: Any) -> str:
        """Mock read_text that raises an OSError."""
        raise OSError("Simulated file read error")

    monkeypatch.setattr(Path, "read_text", mock_read_text)

    result = check_cached_details(invalid_file)
    assert result is None


@pytest.mark.asyncio
async def test_get_package_details_timeout(
    httpx_mock: pytest_httpx.HTTPXMock, static_root: Path
) -> None:
    """Test get_package_details with a timeout error."""
    httpx_mock.add_exception(
        url="https://registry.npmjs.org/monaco-editor",
        method="GET",
        exception=httpx.ReadTimeout("Timeout error"),
    )
    with pytest.raises(DownloadError):
        await get_package_details(static_root)


@pytest.mark.asyncio
async def test_download_swagger_assets_failure(
    httpx_mock: pytest_httpx.HTTPXMock, static_root: Path
) -> None:
    """Test download_swagger_assets with asset download failure."""
    # Mock failure for a specific Swagger asset
    httpx_mock.add_response(
        url="https://raw.githubusercontent.com/swagger-api/swagger-ui/master/dist/swagger-ui.css",
        method="GET",
        status_code=404,
    )

    # Mock successful responses for the remaining assets
    for asset in (
        "swagger-ui.css.map",
        "swagger-ui-bundle.js",
        "swagger-ui-bundle.js.map",
    ):
        httpx_mock.add_response(
            url=f"https://raw.githubusercontent.com/swagger-api/swagger-ui/master/dist/{asset}",
            method="GET",
            content=b"mock-swagger-content",
            is_optional=True,
        )

    with pytest.raises(DownloadError):
        await download_swagger_assets(static_root)


@pytest.mark.asyncio
async def test_check_cached_details_parsing_error(
    static_root: Path,
) -> None:
    """Test check_cached_details with a parsing error."""
    invalid_data_file = static_root / "invalid_data.json"
    invalid_data_file.write_text(
        json.dumps(
            {
                "last_check": "not-a-datetime",  # Invalid datetime format
                "version": "1.2.3",
                "url": "https://example.com",
            }
        ),
        encoding="utf-8",
    )

    result = check_cached_details(invalid_data_file)
    assert result is None


@pytest.mark.asyncio
async def test_download_monaco_editor_extraction_error(
    httpx_mock: pytest_httpx.HTTPXMock,
    static_root: Path,
    registry_response: dict[str, Any],
) -> None:
    """Test for extraction failure in download_monaco_editor."""

    mock_monaco_tarball(httpx_mock, registry_response, valid_tarball=False)

    with pytest.raises(DownloadError):
        await download_monaco_editor(static_root)


@pytest.mark.asyncio
async def test_ensure_extra_static_files_error(
    httpx_mock: pytest_httpx.HTTPXMock,
    registry_response: dict[str, Any],
    static_root: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Test exception handling in ensure_extra_static_files."""
    mock_swagger_assets(httpx_mock, 404, is_optional=True)
    mock_monaco_tarball(httpx_mock, registry_response)

    # Expecting a DownloadError to be raised and logged
    with pytest.raises(DownloadError), caplog.at_level(logging.ERROR):
        await ensure_extra_static_files(static_root)
