# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Tests for waldiez_studio.utils.task_runner."""
# mypy: disable-error-code="attr-defined"
# pylint: disable=missing-function-docstring,missing-return-doc,
# pylint: disable=missing-yield-doc,missing-param-doc,
# pylint: disable=missing-raises-doc,line-too-long,raising-bad-type
# pyright: reportAttributeAccessIssue=false,reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false,reportUnknownVariableType=false
# pyright: reportFunctionMemberAccess=false

import asyncio
import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

from waldiez_studio.engines.base import Engine
from waldiez_studio.utils.task_runner import TaskRunner


class MockEngine(Engine):
    """Mock engine for testing."""

    def __init__(self, **kwargs: Any) -> None:
        # Provide default values for required parameters
        kwargs.setdefault("file_path", Path("/test/file.py"))
        kwargs.setdefault("root_dir", Path("/test"))
        kwargs.setdefault("websocket", MagicMock())
        super().__init__(**kwargs)
        self.start_called = False
        self.handle_client_calls: list[dict[str, Any]] = []
        self.shutdown_called = False
        self.start_exception: Exception | None = None
        self.handle_client_exception: Exception | None = None
        self.shutdown_exception: Exception | None = None

    async def start(self, start_msg: dict[str, Any] | None = None) -> None:
        self.start_called = True
        if self.start_exception:
            raise self.start_exception

    async def handle_client(self, msg: dict[str, Any]) -> None:
        self.handle_client_calls.append(msg)
        if self.handle_client_exception:
            raise self.handle_client_exception

    async def shutdown(self) -> None:
        self.shutdown_called = True
        if self.shutdown_exception:
            raise self.shutdown_exception


@pytest.fixture(name="mock_websocket")
def mock_websocket_fixture() -> AsyncMock:
    """Create a mock websocket."""
    websocket = AsyncMock(spec=WebSocket)
    return websocket


@pytest.fixture(name="mock_engine")
def mock_engine_fixture() -> MockEngine:
    """Create a mock engine."""
    return MockEngine()


@pytest.fixture(name="task_runner")
def task_runner_fixture(
    mock_websocket: AsyncMock,
    mock_engine: MockEngine,
) -> TaskRunner:
    """Create a TaskRunner instance."""
    return TaskRunner(
        task_id="test_task_123", websocket=mock_websocket, engine=mock_engine
    )


@pytest.mark.asyncio
async def test_task_runner_init(
    mock_websocket: AsyncMock, mock_engine: MockEngine
) -> None:
    """Test TaskRunner initialization."""
    task_runner = TaskRunner(
        task_id="test_task_123", websocket=mock_websocket, engine=mock_engine
    )

    assert task_runner.task_id == "test_task_123"
    assert task_runner.websocket == mock_websocket
    assert task_runner.engine == mock_engine


@pytest.mark.asyncio
async def test_listen_successful_flow(task_runner: TaskRunner) -> None:
    """Test successful flow of listen method."""
    # Mock websocket messages
    start_message = {"op": "start", "data": "test"}
    follow_up_message = {"op": "stdin", "data": "input"}

    task_runner.websocket.receive_text.side_effect = [
        json.dumps(start_message),
        json.dumps(follow_up_message),
        WebSocketDisconnect(),  # Simulate disconnect to exit loop
    ]

    await task_runner.listen()

    # Verify engine methods were called
    assert task_runner.engine.start_called
    assert len(task_runner.engine.handle_client_calls) == 1
    assert task_runner.engine.handle_client_calls[0] == follow_up_message
    assert task_runner.engine.shutdown_called


@pytest.mark.asyncio
async def test_listen_invalid_first_message_json(
    task_runner: TaskRunner,
) -> None:
    """Test listen with invalid JSON in first message."""
    task_runner.websocket.receive_text.return_value = "invalid json"

    await task_runner.listen()

    # Should send error message
    task_runner.websocket.send_json.assert_called_once_with(
        {
            "type": "error",
            "data": {"message": "invalid first message"},
        }
    )
    assert not task_runner.engine.start_called


@pytest.mark.asyncio
async def test_listen_invalid_first_message_op(task_runner: TaskRunner) -> None:
    """Test listen with invalid op in first message."""
    invalid_start = {"op": "invalid", "data": "test"}
    task_runner.websocket.receive_text.return_value = json.dumps(invalid_start)

    await task_runner.listen()

    # Should send error message
    task_runner.websocket.send_json.assert_called_once_with(
        {
            "type": "error",
            "data": {"message": "first message must be op=start"},
        }
    )
    assert not task_runner.engine.start_called


@pytest.mark.asyncio
async def test_listen_invalid_follow_up_message(
    task_runner: TaskRunner,
) -> None:
    """Test listen with invalid JSON in follow-up message."""
    start_message = {"op": "start", "data": "test"}

    task_runner.websocket.receive_text.side_effect = [
        json.dumps(start_message),
        "invalid json",  # Invalid follow-up message
        WebSocketDisconnect(),  # Disconnect to exit loop
    ]

    await task_runner.listen()

    # Should handle the error and continue
    assert task_runner.engine.start_called
    assert (
        len(task_runner.engine.handle_client_calls) == 0
    )  # Invalid message ignored
    assert task_runner.engine.shutdown_called

    # Should send error for invalid message
    expected_calls: list[Any] = [
        {
            "type": "error",
            "data": {"message": "invalid message"},
        }
    ]
    # Check that error was sent
    assert any(
        call.args[0] == expected_calls[0]
        for call in task_runner.websocket.send_json.call_args_list
    )


@pytest.mark.asyncio
async def test_listen_websocket_disconnect_early(
    task_runner: TaskRunner,
) -> None:
    """Test listen when websocket disconnects before start message."""
    task_runner.websocket.receive_text.side_effect = WebSocketDisconnect()

    # Should not raise exception
    await task_runner.listen()

    assert not task_runner.engine.start_called
    assert task_runner.engine.shutdown_called


@pytest.mark.asyncio
async def test_listen_engine_start_exception(task_runner: TaskRunner) -> None:
    """Test listen when engine.start raises exception."""
    start_message = {"op": "start", "data": "test"}
    task_runner.websocket.receive_text.return_value = json.dumps(start_message)
    task_runner.engine.start_exception = ValueError("Engine start failed")

    await task_runner.listen()

    assert task_runner.engine.start_called
    assert task_runner.engine.shutdown_called


@pytest.mark.asyncio
async def test_listen_engine_handle_client_exception(
    task_runner: TaskRunner,
) -> None:
    """Test listen when engine.handle_client raises exception."""
    start_message = {"op": "start", "data": "test"}
    follow_up_message = {"op": "stdin", "data": "input"}

    task_runner.websocket.receive_text.side_effect = [
        json.dumps(start_message),
        json.dumps(follow_up_message),
        WebSocketDisconnect(),
    ]
    task_runner.engine.handle_client_exception = ValueError(
        "Handle client failed"
    )

    await task_runner.listen()

    assert task_runner.engine.start_called
    assert len(task_runner.engine.handle_client_calls) == 1
    assert task_runner.engine.shutdown_called


@pytest.mark.asyncio
async def test_listen_engine_shutdown_exception(
    task_runner: TaskRunner,
) -> None:
    """Test listen when engine.shutdown raises exception."""
    start_message = {"op": "start", "data": "test"}
    task_runner.websocket.receive_text.side_effect = [
        json.dumps(start_message),
        WebSocketDisconnect(),
    ]
    task_runner.engine.shutdown_exception = ValueError("Shutdown failed")

    # Should not raise exception even if shutdown fails
    await task_runner.listen()

    assert task_runner.engine.start_called
    assert task_runner.engine.shutdown_called


@pytest.mark.asyncio
async def test_listen_cancellation(task_runner: TaskRunner) -> None:
    """Test listen handles cancellation properly."""
    start_message = {"op": "start", "data": "test"}

    async def mock_receive_text() -> str:
        # First call returns start message
        if not hasattr(mock_receive_text, "called"):
            mock_receive_text.called = True
            return json.dumps(start_message)
        # Subsequent calls should raise CancelledError
        raise asyncio.CancelledError()

    task_runner.websocket.receive_text.side_effect = mock_receive_text

    with pytest.raises(asyncio.CancelledError):
        await task_runner.listen()

    assert task_runner.engine.start_called
    assert task_runner.engine.shutdown_called


@pytest.mark.asyncio
async def test_send_successful(task_runner: TaskRunner) -> None:
    """Test successful send method."""
    payload = {"type": "test", "data": {"message": "hello"}}

    await task_runner.send(payload)

    task_runner.websocket.send_json.assert_called_once_with(payload)


@pytest.mark.asyncio
async def test_send_exception_suppressed(task_runner: TaskRunner) -> None:
    """Test send method suppresses exceptions."""
    payload = {"type": "test", "data": {"message": "hello"}}
    task_runner.websocket.send_json.side_effect = Exception("Send failed")

    # Should not raise exception
    await task_runner.send(payload)

    task_runner.websocket.send_json.assert_called_once_with(payload)


@pytest.mark.asyncio
async def test_listen_multiple_messages_flow(task_runner: TaskRunner) -> None:
    """Test listen with multiple follow-up messages."""
    start_message = {"op": "start", "data": "test"}
    messages = [
        {"op": "stdin", "data": "input1"},
        {"op": "stdin", "data": "input2"},
        {"op": "interrupt"},
        {"op": "stdin", "data": "input3"},
    ]

    task_runner.websocket.receive_text.side_effect = [
        json.dumps(start_message),
        *[json.dumps(msg) for msg in messages],
        WebSocketDisconnect(),
    ]

    await task_runner.listen()

    assert task_runner.engine.start_called
    assert len(task_runner.engine.handle_client_calls) == len(messages)
    assert task_runner.engine.handle_client_calls == messages
    assert task_runner.engine.shutdown_called


@pytest.mark.asyncio
async def test_listen_with_logging(task_runner: TaskRunner) -> None:
    """Test that logging occurs appropriately."""
    with patch("waldiez_studio.utils.task_runner.LOG") as mock_log:
        # Test websocket disconnect logging
        task_runner.websocket.receive_text.side_effect = [
            json.dumps({"op": "start"}),
            WebSocketDisconnect(),
        ]

        await task_runner.listen()

        # Should log disconnect
        mock_log.debug.assert_called_with("WS disconnected")


@pytest.mark.asyncio
async def test_semaphore_context_manager() -> None:
    """Test that semaphore is properly used as context manager."""
    # This test ensures the semaphore is acquired and released properly
    with patch(
        "waldiez_studio.utils.task_runner._active_tasks"
    ) as mock_semaphore:
        mock_semaphore.__aenter__ = AsyncMock()
        mock_semaphore.__aexit__ = AsyncMock()

        websocket = AsyncMock(spec=WebSocket)
        engine = MockEngine()
        task_runner = TaskRunner("test", websocket, engine)

        # Mock early disconnect to exit quickly
        websocket.receive_text.side_effect = WebSocketDisconnect()

        await task_runner.listen()

        # Verify semaphore was entered and exited
        mock_semaphore.__aenter__.assert_called_once()
        mock_semaphore.__aexit__.assert_called_once()
