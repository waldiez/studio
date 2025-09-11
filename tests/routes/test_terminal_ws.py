# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Tests for the terminal WebSocket routes."""
# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,missing-yield-doc
# pylint: disable=missing-param-doc,missing-raises-doc,invalid-name,no-self-use
# pyright: reportPrivateUsage=false

import json
from pathlib import Path
from typing import Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI, WebSocketDisconnect
from fastapi.testclient import TestClient

from waldiez_studio.routes import common
from waldiez_studio.routes.terminal_ws import _safe_workdir, router


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


class TestSafeWorkdir:
    """Test the _safe_workdir function."""

    def test_valid_relative_path(self, tmp_path: Path) -> None:
        """Test valid relative path."""
        subdir = tmp_path / "subdir"
        subdir.mkdir()
        result = _safe_workdir(tmp_path, "subdir")
        assert result == subdir

    def test_none_path_returns_root(self, tmp_path: Path) -> None:
        """Test None path returns root."""
        result = _safe_workdir(tmp_path, None)
        assert result == tmp_path

    def test_empty_path_returns_root(self, tmp_path: Path) -> None:
        """Test empty path returns root."""
        result = _safe_workdir(tmp_path, "")
        assert result == tmp_path

    def test_nonexistent_path_returns_root(self, tmp_path: Path) -> None:
        """Test nonexistent path returns root."""
        result = _safe_workdir(tmp_path, "nonexistent")
        assert result == tmp_path

    def test_path_traversal_blocked(self, tmp_path: Path) -> None:
        """Test path traversal is blocked."""
        with pytest.raises(ValueError, match="cwd outside workspace"):
            _safe_workdir(tmp_path, "../")

    def test_absolute_path_outside_workspace_blocked(
        self, tmp_path: Path
    ) -> None:
        """Test absolute path outside workspace is blocked."""
        with pytest.raises(ValueError, match="cwd outside workspace"):
            _safe_workdir(tmp_path, "/etc")


class TestTerminalWebSocket:
    """Test the terminal WebSocket endpoint."""

    @patch("waldiez_studio.routes.terminal_ws.get_session")
    def test_terminal_ws_connection(
        self,
        mock_get_session: MagicMock,
        client: TestClient,
    ) -> None:
        """Test successful terminal WebSocket connection."""
        # Setup mock session
        mock_session = MagicMock()
        mock_session.read = AsyncMock(return_value=b"")
        mock_session.is_alive = MagicMock(return_value=False)
        mock_session.write = MagicMock()
        mock_session.resize = MagicMock()
        mock_session.close = MagicMock()
        mock_get_session.return_value = mock_session

        with client.websocket_connect("/ws/terminal") as websocket:
            # Send initial resize message
            websocket.send_text(
                json.dumps({"op": "resize", "rows": 30, "cols": 100})
            )

            # Should receive session_end when session is not alive
            response = websocket.receive_json()
            assert response["type"] == "session_end"

        mock_get_session.assert_called_once()
        mock_session.close.assert_called_once()

    @patch("waldiez_studio.routes.terminal_ws.get_session")
    def test_terminal_ws_stdin_operation(
        self,
        mock_get_session: MagicMock,
        client: TestClient,
    ) -> None:
        """Test stdin operation."""
        mock_session = MagicMock()
        mock_session.read = AsyncMock(return_value=b"")
        mock_session.is_alive = MagicMock(return_value=False)
        mock_session.write = MagicMock()
        mock_session.close = MagicMock()
        mock_get_session.return_value = mock_session

        with client.websocket_connect("/ws/terminal") as websocket:
            # Send stdin data
            websocket.send_text(
                json.dumps({"op": "stdin", "data": "echo hello\n"})
            )
            # Receive session_end
            response = websocket.receive_json()
            assert response["type"] == "session_end"

        mock_get_session.assert_called_once()

    @patch("waldiez_studio.routes.terminal_ws.get_session")
    def test_terminal_ws_resize_operation(
        self,
        mock_get_session: MagicMock,
        client: TestClient,
    ) -> None:
        """Test resize operation."""
        mock_session = MagicMock()
        mock_session.read = AsyncMock(return_value=b"")
        mock_session.is_alive = MagicMock(return_value=False)
        mock_session.resize = MagicMock()
        mock_session.close = MagicMock()
        mock_get_session.return_value = mock_session

        with client.websocket_connect("/ws/terminal") as websocket:
            # Send resize command
            websocket.send_text(
                json.dumps({"op": "resize", "rows": 26, "cols": 121})
            )

            # Receive session_end
            response = websocket.receive_json()
            assert response["type"] == "session_end"

        mock_session.resize.assert_called_with(26, 121)

    @patch("waldiez_studio.routes.terminal_ws.get_session")
    def test_terminal_ws_interrupt_operation(
        self,
        mock_get_session: MagicMock,
        client: TestClient,
    ) -> None:
        """Test interrupt operation."""
        alive_calls = [True] * 10 + [False]
        mock_session = MagicMock()
        mock_session.read = AsyncMock(return_value=b"")
        mock_session.is_alive = MagicMock(side_effect=alive_calls)
        mock_session.interrupt = MagicMock()
        mock_session.close = MagicMock()
        mock_get_session.return_value = mock_session

        with client.websocket_connect("/ws/terminal") as websocket:
            # Send interrupt command
            websocket.send_text(json.dumps({"op": "noop"}))

            # Now send stdin - this should be processed in the main loop
            websocket.send_text(
                json.dumps({"op": "stdin", "data": "echo hello\n"})
            )
            websocket.send_text(json.dumps({"op": "interrupt"}))

            # Receive session_end
            response = websocket.receive_json()
            assert response["type"] == "session_end"

        mock_get_session.assert_called_once()
        mock_session.interrupt.assert_called_once()

    @patch("waldiez_studio.routes.terminal_ws.get_session")
    def test_terminal_ws_terminate_operation(
        self,
        mock_get_session: MagicMock,
        client: TestClient,
    ) -> None:
        """Test terminate operation."""
        mock_session = MagicMock()
        mock_session.read = AsyncMock(return_value=b"")
        mock_session.is_alive = MagicMock(return_value=False)
        mock_session.terminate = MagicMock()
        mock_session.close = MagicMock()
        mock_get_session.return_value = mock_session

        with client.websocket_connect("/ws/terminal") as websocket:
            websocket.send_text(json.dumps({"op": "noop"}))
            # Send terminate command
            websocket.send_text(json.dumps({"op": "terminate"}))

            # Receive session_end
            response = websocket.receive_json()
            assert response["type"] == "session_end"
        mock_get_session.assert_called_once()

    @patch("waldiez_studio.routes.terminal_ws.get_session")
    def test_terminal_ws_data_output(
        self,
        mock_get_session: MagicMock,
        client: TestClient,
    ) -> None:
        """Test data output from terminal."""
        mock_session = MagicMock()
        # First call returns data, second call returns empty (session ends)
        mock_session.read = AsyncMock(side_effect=[b"Hello World\n", b""])
        mock_session.is_alive = MagicMock(return_value=False)
        mock_session.close = MagicMock()
        mock_get_session.return_value = mock_session

        with client.websocket_connect("/ws/terminal") as websocket:
            # First message should be the data
            response1 = websocket.receive_json()
            assert response1["type"] == "data"
            assert response1["data"] == "Hello World\n"

            # Second message should be session_end
            response2 = websocket.receive_json()
            assert response2["type"] == "session_end"

    def test_terminal_ws_invalid_cwd(self, client: TestClient) -> None:
        """Test invalid cwd parameter."""
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect(
                "/ws/terminal?cwd=../invalid"
            ) as websocket:
                websocket.receive_text()
        assert exc_info.value.code == 1008

    @patch("waldiez_studio.routes.terminal_ws.get_session")
    def test_terminal_ws_with_valid_cwd(
        self,
        mock_get_session: MagicMock,
        client: TestClient,
        tmp_path: Path,
    ) -> None:
        """Test with valid cwd parameter."""
        subdir = tmp_path / "subdir"
        subdir.mkdir()

        mock_session = MagicMock()
        mock_session.read = AsyncMock(return_value=b"")
        mock_session.is_alive = MagicMock(return_value=False)
        mock_session.close = MagicMock()
        mock_get_session.return_value = mock_session

        with client.websocket_connect("/ws/terminal?cwd=subdir") as websocket:
            response = websocket.receive_json()
            assert response["type"] == "session_end"

        # Verify get_session was called with the subdirectory
        mock_get_session.assert_called_once_with(subdir)

    @patch("waldiez_studio.routes.terminal_ws.get_session")
    def test_terminal_ws_invalid_json(
        self,
        mock_get_session: MagicMock,
        client: TestClient,
    ) -> None:
        """Test handling of invalid JSON messages."""
        mock_session = MagicMock()
        mock_session.read = AsyncMock(return_value=b"")
        mock_session.is_alive = MagicMock(return_value=False)
        mock_session.close = MagicMock()
        mock_get_session.return_value = mock_session

        with client.websocket_connect("/ws/terminal") as websocket:
            # Send invalid JSON
            websocket.send_text("invalid json")

            # Should still receive session_end (invalid JSON is ignored)
            response = websocket.receive_json()
            assert response["type"] == "session_end"

    @patch("waldiez_studio.routes.terminal_ws.get_session")
    def test_terminal_ws_unknown_operation(
        self,
        mock_get_session: MagicMock,
        client: TestClient,
    ) -> None:
        """Test handling of unknown operations."""
        mock_session = MagicMock()
        mock_session.read = AsyncMock(return_value=b"")
        mock_session.is_alive = MagicMock(return_value=False)
        mock_session.close = MagicMock()
        mock_get_session.return_value = mock_session

        with client.websocket_connect("/ws/terminal") as websocket:
            # Send unknown operation
            websocket.send_text(json.dumps({"op": "unknown_command"}))

            # Should receive session_end (unknown ops are ignored)
            response = websocket.receive_json()
            assert response["type"] == "session_end"

    @patch("waldiez_studio.routes.terminal_ws.get_session")
    def test_terminal_ws_start_operation_ignored(
        self,
        mock_get_session: MagicMock,
        client: TestClient,
    ) -> None:
        """Test that start operation is ignored (session already started)."""
        mock_session = MagicMock()
        mock_session.read = AsyncMock(return_value=b"")
        mock_session.is_alive = MagicMock(return_value=False)
        mock_session.close = MagicMock()
        mock_get_session.return_value = mock_session

        with client.websocket_connect("/ws/terminal") as websocket:
            # Send start command (should be ignored)
            websocket.send_text(json.dumps({"op": "start"}))

            # Should receive session_end
            response = websocket.receive_json()
            assert response["type"] == "session_end"

    @patch("waldiez_studio.routes.terminal_ws.get_session")
    def test_terminal_ws_resize_with_defaults(
        self,
        mock_get_session: MagicMock,
        client: TestClient,
    ) -> None:
        """Test resize with missing or invalid dimensions uses defaults."""
        mock_session = MagicMock()
        mock_session.read = AsyncMock(return_value=b"")
        mock_session.is_alive = MagicMock(return_value=False)
        mock_session.resize = MagicMock()
        mock_session.close = MagicMock()
        mock_get_session.return_value = mock_session

        with client.websocket_connect("/ws/terminal") as websocket:
            websocket.send_text(json.dumps({"op": "noop"}))
            # Send resize with missing dimensions
            websocket.send_text(json.dumps({"op": "resize"}))

            # Receive session_end
            response = websocket.receive_json()
            assert response["type"] == "session_end"

        # Should use default dimensions (24, 80)
        mock_session.resize.assert_called_with(24, 80)

    @patch("waldiez_studio.routes.terminal_ws.get_session")
    def test_terminal_ws_kill_operation(
        self,
        mock_get_session: MagicMock,
        client: TestClient,
    ) -> None:
        """Test kill operation."""
        mock_session = MagicMock()
        mock_session.read = AsyncMock(return_value=b"")
        mock_session.is_alive = MagicMock(return_value=False)
        mock_session.terminate = MagicMock()
        mock_session.close = MagicMock()
        mock_get_session.return_value = mock_session

        with client.websocket_connect("/ws/terminal") as websocket:
            websocket.send_text(json.dumps({"op": "noop"}))
            # Send kill command
            websocket.send_text(json.dumps({"op": "kill"}))

            # Receive session_end
            response = websocket.receive_json()
            assert response["type"] == "session_end"
        mock_get_session.assert_called_once()
