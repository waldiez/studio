# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Tests for the flow routes."""
# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,missing-yield-doc,missing-param-doc,missing-raises-doc,line-too-long,unused-argument

from pathlib import Path
from typing import Any, AsyncGenerator
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from waldiez_studio.routes import common
from waldiez_studio.routes.flow import api


@pytest.fixture(autouse=True, name="client")
async def get_client(
    tmp_path: Path,
) -> AsyncGenerator[AsyncClient, None]:
    """Get the FastAPI test client."""
    app = FastAPI()

    def override_get_root_directory() -> Path:
        return tmp_path

    app.include_router(api)
    app.dependency_overrides = {
        common.get_root_directory: override_get_root_directory
    }

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as api_client:
        yield api_client


@pytest.mark.asyncio
async def test_get_flow_contents(client: AsyncClient, tmp_path: Path) -> None:
    test_flow = tmp_path / "test_get_flow_contents.waldiez"
    test_flow.write_text('{"key": "value"}', encoding="utf-8")

    response = await client.get(
        "/flow", params={"path": "test_get_flow_contents.waldiez"}
    )
    assert response.status_code == 200
    assert response.json() == {"key": "value"}
    test_flow.unlink()


@pytest.mark.asyncio
async def test_get_flow_contents_not_a_json_file(
    client: AsyncClient, tmp_path: Path
) -> None:
    test_flow = tmp_path / "test_get_flow_contents_not_a_json_file.waldiez"
    test_flow.write_text("not a json file", encoding="utf-8")

    response = await client.get(
        "/flow",
        params={"path": "test_get_flow_contents_not_a_json_file.waldiez"},
    )
    assert response.status_code == 500
    assert (
        response.json()["detail"] == "Error: Could not read the flow contents"
    )
    test_flow.unlink()


@pytest.mark.asyncio
async def test_get_flow_invalid_path(client: AsyncClient) -> None:
    response = await client.get(
        "/flow", params={"path": "should? not\\resolve #"}
    )
    assert response.status_code in (400, 404)
    assert response.json()["detail"] in (
        "Error: Invalid file",
        "Error: File not found",
    )


@pytest.mark.asyncio
async def test_get_flow_nonexistent_file(client: AsyncClient) -> None:
    response = await client.get("/flow", params={"path": "nonexistent.waldiez"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Error: File not found"


@pytest.mark.asyncio
async def test_get_flow_invalid_file(
    client: AsyncClient, tmp_path: Path
) -> None:
    (tmp_path / "nonexistent.txt").write_text(
        "Invalid content", encoding="utf-8"
    )
    response = await client.get("/flow", params={"path": "nonexistent.txt"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Error: Invalid file type"


@pytest.mark.asyncio
async def test_save_flow_contents(client: AsyncClient, tmp_path: Path) -> None:
    test_flow = tmp_path / "test_save_flow_contents.waldiez"
    test_flow.write_text("{}", encoding="utf-8")

    new_data = {"key": "new_value"}
    response = await client.post(
        "/flow",
        json={"contents": new_data},
        params={"path": "test_save_flow_contents.waldiez"},
    )
    assert response.status_code == 200
    assert test_flow.read_text(encoding="utf-8") == '{"key": "new_value"}'
    test_flow.unlink()


@pytest.mark.asyncio
async def test_save_flow_invalid_path(client: AsyncClient) -> None:
    response = await client.post(
        "/flow",
        json={"contents": "not important"},
        params={"path": "../invalid"},
    )
    assert response.status_code in (400, 404)
    assert response.json()["detail"] in (
        "Error: Invalid file",
        "Error: File not found",
    )


@pytest.mark.asyncio
async def test_save_flow_permission_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    test_flow = tmp_path / "test_save_flow_permission_error.waldiez"
    test_flow.write_text("{}", encoding="utf-8")

    def mock_write_text(*args: Any, **kwargs: Any) -> None:
        raise PermissionError("Mocked permission error")

    monkeypatch.setattr(Path, "write_text", mock_write_text)

    response = await client.post(
        "/flow",
        json={"contents": {"key": "value"}},
        params={"path": "test_save_flow_permission_error.waldiez"},
    )
    assert response.status_code == 500
    assert "Could not save the flow" in response.json()["detail"]
    test_flow.unlink()


@pytest.mark.asyncio
async def test_export_flow(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    test_flow = tmp_path / "test_export_flow.waldiez"
    exported_file = tmp_path / "test_export_flow.py"
    test_flow.write_text("{}", encoding="utf-8")

    exporter = MagicMock()

    def mock_load(*args: Any, **kwargs: Any) -> MagicMock:
        return exporter

    def mock_export(path: Path, force: bool = False) -> None:
        print("exporting to", path)
        dest = Path(str(path).replace(".waldiez", ".py"))
        dest.write_text("exported", encoding="utf-8")

    exporter.load = mock_load
    exporter.export = mock_export

    monkeypatch.setattr("waldiez.exporter.WaldiezExporter.load", mock_load)
    monkeypatch.setattr("waldiez.exporter.WaldiezExporter.export", mock_export)

    response = await client.post(
        "/flow/export",
        params={"path": "test_export_flow.waldiez", "extension": "py"},
    )
    assert response.status_code == 200
    test_flow.unlink()
    assert exported_file.exists()
    assert exported_file.read_text(encoding="utf-8") == "exported"
    exported_file.unlink()


@pytest.mark.asyncio
async def test_export_flow_invalid_extension(
    client: AsyncClient, tmp_path: Path
) -> None:
    test_flow = tmp_path / "test_export_flow_invalid_extension.waldiez"
    test_flow.write_text("{}", encoding="utf-8")
    response = await client.post(
        "/flow/export",
        params={
            "path": "test_export_flow_invalid_extension.waldiez",
            "extension": "txt",
        },
    )
    assert response.status_code == 422
    test_flow.unlink()


@pytest.mark.asyncio
async def test_export_flow_invalid_path(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/flow/export",
        params={
            "path": "test_export_flow_invalid_path.waldiez",
            "extension": "py",
        },
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Error: File not found"


@pytest.mark.asyncio
async def test_export_flow_load_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    test_flow = tmp_path / "test_export_flow_load_error.waldiez"
    test_flow.write_text("{}", encoding="utf-8")

    def mock_load(*args: Any, **kwargs: Any) -> None:
        raise ValueError("Mocked load error")

    monkeypatch.setattr("waldiez.exporter.WaldiezExporter.load", mock_load)

    response = await client.post(
        "/flow/export",
        params={
            "path": "test_export_flow_load_error.waldiez",
            "extension": "py",
        },
    )
    assert response.status_code == 400
    assert "Mocked load error" in response.json()["detail"]
    test_flow.unlink()


@pytest.mark.asyncio
async def test_export_flow_export_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    test_flow = tmp_path / "test_export_flow_export_error.waldiez"
    test_flow.write_text("{}", encoding="utf-8")

    exporter = MagicMock()

    def mock_load(*args: Any, **kwargs: Any) -> MagicMock:
        return exporter

    def mock_export(*args: Any, **kwargs: Any) -> None:
        raise ValueError("Mocked export error")

    exporter.load = mock_load
    exporter.export = mock_export

    monkeypatch.setattr("waldiez.exporter.WaldiezExporter.load", mock_load)
    monkeypatch.setattr("waldiez.exporter.WaldiezExporter.export", mock_export)

    response = await client.post(
        "/flow/export",
        params={
            "path": "test_export_flow_export_error.waldiez",
            "extension": "ipynb",
        },
    )
    assert response.status_code == 500
    assert "Mocked export error" in response.json()["detail"]
    test_flow.unlink()
