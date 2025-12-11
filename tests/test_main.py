# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,missing-yield-doc,missing-param-doc,missing-raises-doc,line-too-long, unused-argument

"""Tests for main.py"""

import json
import os
from collections.abc import AsyncGenerator, Generator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient


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
    current = os.environ.get("WALDIEZ_STUDIO_ROOT_DIR", "")
    os.environ["WALDIEZ_STUDIO_ROOT_DIR"] = str(tmp_path)
    yield tmp_path
    if current:
        os.environ["WALDIEZ_STUDIO_ROOT_DIR"] = current
    else:
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


def setup_static_files(static_root: Path) -> None:
    """Setup the static files."""
    # Create a frontend directory
    (static_root / "frontend").mkdir()
    (static_root / "frontend" / "favicon.ico").touch()
    (static_root / "frontend" / "robots.txt").touch()
    index_html = static_root / "frontend" / "index.html"
    index_html.write_text(
        "<html><head><title>Waldiez Studio</title></head><body><h1>Waldiez Studio</h1></body></html>",
        encoding="utf-8",
    )
    # Create a swagger directory
    (static_root / "swagger" / "js").mkdir(parents=True)
    (static_root / "swagger" / "js" / "swagger-ui-bundle.js").touch()
    (static_root / "swagger" / "js" / "swagger-ui-bundle.js.map").touch()
    (static_root / "swagger" / "css").mkdir(parents=True)
    (static_root / "swagger" / "css" / "swagger-ui.css").touch()
    (static_root / "swagger" / "css" / "swagger-ui.css.map").touch()
    # Create a monaco directory
    (static_root / "monaco").mkdir()
    (static_root / "monaco" / "vs").mkdir()
    (static_root / "monaco" / "vs" / "loader.js").touch()
    # version_file = static_root / "monaco_details.json"
    version_file = static_root / "monaco" / "monaco_details.json"
    monaco_details = {
        "version": "1.2.3",
        "url": "https://example.com",
        "sha_sum": "123abc",
        "last_check": (datetime.now(timezone.utc)).isoformat(),
    }
    version_file.write_text(
        json.dumps(monaco_details, indent=2), encoding="utf-8"
    )


@pytest.fixture(name="client")
async def client_fixture(
    tmp_path: Path,
) -> AsyncGenerator[AsyncClient, None]:
    """Setup the test client."""

    static_path = tmp_path / "main" / "static"
    static_path.mkdir(parents=True, exist_ok=True)
    os.environ["WALDIEZ_STUDIO_ROOT_DIR"] = str(static_path)
    os.environ["WALDIEZ_STUDIO_BASE_URL"] = "/custom/"
    setup_static_files(Path(os.environ["WALDIEZ_STUDIO_ROOT_DIR"]))
    # pylint: disable=import-outside-toplevel
    from waldiez_studio.main import app

    async with LifespanManager(app, startup_timeout=10) as manager:
        async with AsyncClient(
            transport=ASGITransport(app=manager.app),
            base_url="http://test/custom",
        ) as client:
            yield client

    del os.environ["WALDIEZ_STUDIO_ROOT_DIR"]
    del os.environ["WALDIEZ_STUDIO_BASE_URL"]


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient) -> None:
    """Test the health check endpoints."""
    response = await client.get("/health")
    assert response.status_code == 200

    response = await client.get("/healthz")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_robots_txt(client: AsyncClient) -> None:
    """Test the robots.txt endpoint."""
    response = await client.get("/robots.txt")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/plain; charset=utf-8"


@pytest.mark.asyncio
async def test_favicon(client: AsyncClient) -> None:
    """Test the favicon endpoint."""
    response = await client.get("/favicon.ico")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/")


@pytest.mark.asyncio
async def test_docs_url(client: AsyncClient) -> None:
    """Test the docs endpoint."""
    response = await client.get("/docs")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"
    assert "Swagger UI" in response.text


@pytest.mark.asyncio
async def test_docs_redirect(client: AsyncClient) -> None:
    """Test the docs redirect."""
    response = await client.get("/docs/")
    assert response.status_code == 307


@pytest.mark.asyncio
async def test_catch_all(client: AsyncClient) -> None:
    """Test the catch-all route."""
    response = await client.get("/nonexistent-path")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"
    assert "Waldiez Studio" in response.text
