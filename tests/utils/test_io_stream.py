# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# pylint: disable=missing-param-doc,missing-type-doc,missing-return-doc
# pylint: disable=missing-function-docstring,missing-yield-doc
"""Test waldiez_studio.utils.io_stream module."""

import asyncio
import concurrent
import io
import threading
import time
from typing import Any, Generator, Tuple
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest

from waldiez_studio.utils.io_stream import (
    START_PROMPT,
    IOWebsocketsStream,
    WsServerConnection,
)


@pytest.fixture(scope="function", name="mock_websocket")
def mock_websocket_fixture() -> MagicMock:
    """Fixture to create a mock WebSocket."""
    mock = MagicMock()
    mock.receive_json = AsyncMock()
    mock.send_json = AsyncMock()
    return mock


@pytest.fixture(scope="module", name="mock_event_loop")
def mock_event_loop_fixture() -> (
    Generator[asyncio.AbstractEventLoop, None, None]  # fmt: skip
):
    """Create a running event loop in a background thread."""
    loop = asyncio.new_event_loop()

    def start_loop() -> None:
        """Start the event loop."""
        asyncio.set_event_loop(loop)
        loop.run_forever()

    thread = threading.Thread(target=start_loop, daemon=True)
    thread.start()

    time.sleep(0.1)

    yield loop

    loop.call_soon_threadsafe(loop.stop)
    thread.join()


@pytest.fixture(scope="function", name="ws_server_connection")
def ws_server_connection_fixture(
    mock_websocket: AsyncMock, mock_event_loop: asyncio.AbstractEventLoop
) -> WsServerConnection:
    """Fixture to create a WsServerConnection instance."""
    return WsServerConnection(mock_websocket, mock_event_loop, input_timeout=4)


@pytest.mark.parametrize(
    "response,expected",
    [
        ({"payload": "hello"}, "hello"),
        (None, "\n"),
        ({}, "\n"),
        ("plain text", "plain text"),
    ],
)
def test_recv(
    ws_server_connection: WsServerConnection,
    mock_websocket: MagicMock,
    response: Any,
    expected: str,
) -> None:
    """Test receiving a message."""
    mock_websocket.receive_json.return_value = response

    with concurrent.futures.ThreadPoolExecutor() as executor:
        future = executor.submit(ws_server_connection.recv)
        result = future.result()

    assert result == expected


def test_recv_timeout(
    ws_server_connection: WsServerConnection,
    mock_websocket: MagicMock,
) -> None:
    """Test recv method when it times out."""
    mock_websocket.receive_json.side_effect = asyncio.TimeoutError
    result = ws_server_connection.recv(timeout=1)
    assert result == "\n"


def test_recv_exception(
    ws_server_connection: WsServerConnection,
    mock_websocket: MagicMock,
) -> None:
    """Test recv method when an exception occurs."""
    mock_websocket.receive_json.side_effect = Exception("Unexpected Error")
    with patch("waldiez_studio.utils.io_stream.LOG.error") as mock_log:
        result = ws_server_connection.recv()
        mock_log.assert_called_once()
    assert result == "\n"


@pytest.mark.parametrize(
    "message,expected",
    [
        (">", (True, START_PROMPT)),
        (">> ", (True, START_PROMPT)),
        ("Some text", (False, "Some text")),
        (b">>", (True, START_PROMPT)),
        (b"random bytes", (False, "random bytes")),
        ({"key": "value"}, (False, '{"key": "value"}')),
        (42, (False, "42")),
    ],
)
def test_is_input_prompt(
    ws_server_connection: WsServerConnection,
    message: Any,
    expected: Tuple[bool, str],
) -> None:
    """Test if the message is identified as an input prompt."""
    assert ws_server_connection.is_input_prompt(message) == expected


def test_send(
    ws_server_connection: WsServerConnection,
    mock_websocket: MagicMock,
) -> None:
    """Test sending a normal message."""
    ws_server_connection.send("Hello")
    mock_websocket.send_json.assert_called_with(
        {"type": "print", "data": "Hello"}
    )


def test_send_input_prompt(
    ws_server_connection: WsServerConnection,
    mock_websocket: MagicMock,
) -> None:
    """Test sending an input prompt message."""
    with patch.object(
        ws_server_connection, "is_input_prompt", return_value=(True, ">>")
    ):
        ws_server_connection.send(">>")

    expected_calls = [
        ({"type": "input", "data": ">>"},),
        ({"type": "print", "data": ">>"},),
    ]

    mock_websocket.send_json.assert_has_calls(
        [call(*expected_calls[0]), call(*expected_calls[1])]
    )


def test_send_exception(
    ws_server_connection: WsServerConnection,
    mock_websocket: MagicMock,
) -> None:
    """Test send method when an exception occurs."""
    mock_websocket.send_json.side_effect = Exception("Send Error")

    with patch("waldiez_studio.utils.io_stream.LOG.error") as mock_log:
        ws_server_connection.send("test message")
        mock_log.assert_called_once()


def test_io_stream_print(
    ws_server_connection: WsServerConnection,
    mock_websocket: MagicMock,
) -> None:
    """Test IOWebsocketsStream print method."""
    loop = ws_server_connection.loop
    io_stream = IOWebsocketsStream(mock_websocket, loop)
    setattr(io_stream.server_connection, "send", MagicMock())
    io_stream.print("Hello")
    # pylint: disable=no-member
    io_stream.server_connection.send.assert_called_with(  # type: ignore
        "Hello\n"
    )
    file = io.StringIO()
    file.write(" World")
    io_stream.print("Hello", file=file)
    io_stream.server_connection.send.assert_called_with(  # type: ignore
        "Hello World\n"
    )
    file_no_io = "no .getvalue"
    io_stream.print("Hello", file=file_no_io)
    io_stream.server_connection.send.assert_called_with(  # type: ignore
        "Hello\n"
    )
