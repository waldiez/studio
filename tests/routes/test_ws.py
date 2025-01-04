# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Tests for the WebSocket routes."""
# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,missing-yield-doc,missing-param-doc,missing-raises-doc,invalid-name

from pathlib import Path
from typing import Generator
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI, WebSocketDisconnect
from fastapi.testclient import TestClient

from waldiez_studio.routes import common
from waldiez_studio.routes.ws import router


@pytest.fixture(autouse=True, name="client")
def get_client(
    tmp_path: Path,
) -> Generator[TestClient, None, None]:
    """Get the FastAPI test client."""
    app = FastAPI()

    def override_get_root_directory() -> Path:
        return tmp_path

    app.include_router(router)
    app.dependency_overrides = {
        common.get_root_directory: override_get_root_directory
    }
    with TestClient(app) as client:
        yield client


@pytest.mark.asyncio
async def test_websocket_valid_path(client: TestClient, tmp_path: Path) -> None:
    tmp_file = tmp_path / "test_websocket_valid_path.waldiez"
    tmp_file.write_text('{}"type": "flow"}')
    with client.websocket_connect(
        "/ws?path=test_websocket_valid_path.waldiez"
    ) as websocket:
        assert websocket is not None
        websocket.send_json({"action": "status"})
        websocket.close()
    tmp_file.unlink()


@pytest.mark.asyncio
async def test_websocket_invalid_path(client: TestClient) -> None:
    with patch(
        "waldiez_studio.routes.ws.check_path",
        side_effect=Exception("Invalid path"),
    ) as mock_check_path:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect("/ws?path=invalid_path") as websocket:
                websocket.receive_text()
        assert exc_info.value.code == 1008
        mock_check_path.assert_called_once()


@pytest.mark.asyncio
async def test_websocket_connection_error(client: TestClient) -> None:
    with (
        patch(
            "waldiez_studio.routes.ws.check_path",
            return_value=Path("/valid/path/test.waldiez"),
        ),
        patch("waldiez_studio.routes.ws.TaskRunner") as MockTaskRunner,
    ):
        # Simulate error during listen
        mock_task_runner = MockTaskRunner.return_value
        mock_task_runner.listen = AsyncMock(
            side_effect=Exception("Connection error")
        )

        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect("/ws?path=test.waldiez") as websocket:
                websocket.send_json({"action": "status"})
                websocket.receive_text()
        assert exc_info.value.code == 1006
        mock_task_runner.listen.assert_called_once()
