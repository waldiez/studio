# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2026 Waldiez and contributors.

# pyright: reportPrivateUsage=false
# flake8: noqa: E501
# pylint: disable=missing-function-docstring,protected-access
# pylint: disable=missing-return-doc,missing-param-doc,line-too-long
"""Tests for waldiez engine."""

import asyncio
import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from waldiez_studio.engines.waldiez_engine import WaldiezEngine


@pytest.fixture(name="mock_websocket")
def mock_websocket_fixture() -> AsyncMock:
    """Create a mock websocket."""
    websocket = AsyncMock()
    websocket.send = AsyncMock()
    websocket.send_json = AsyncMock()
    return websocket


@pytest.fixture(name="sample_waldiez_file")
def sample_waldiez_file_fixture(tmp_path: Path) -> Path:
    """Create a sample waldiez file for testing."""
    waldiez_content: dict[str, Any] = {
        "type": "flow",
        "nodes": [
            {"id": "agent1", "type": "agent", "data": {"name": "Assistant"}}
        ],
        "edges": [],
        "metadata": {},
    }

    waldiez_file = tmp_path / "test.waldiez"
    waldiez_file.write_text(json.dumps(waldiez_content))
    return waldiez_file


@pytest.mark.asyncio
async def test_waldiez_engine_initialization(
    mock_websocket: AsyncMock,
    sample_waldiez_file: Path,
    tmp_path: Path,
) -> None:
    """Test waldiez engine initialization."""
    engine = WaldiezEngine(
        file_path=sample_waldiez_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    assert engine.file_path == sample_waldiez_file
    assert engine.root_dir == tmp_path
    assert engine.websocket == mock_websocket
    assert engine._delegate is None
    assert engine._task is None


@pytest.mark.asyncio
async def test_waldiez_engine_start_successful(
    mock_websocket: AsyncMock,
    sample_waldiez_file: Path,
    tmp_path: Path,
) -> None:
    """Test successful waldiez engine start process."""
    engine = WaldiezEngine(
        file_path=sample_waldiez_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    # Mock the waldiez exporter
    with patch(
        "waldiez_studio.engines.waldiez_engine.WaldiezExporter"
    ) as mock_exporter:
        mock_exporter_instance = MagicMock()
        mock_exporter.load.return_value = mock_exporter_instance
        mock_exporter_instance.export = MagicMock()

        # Mock the subprocess engine
        with patch(
            "waldiez_studio.engines.waldiez_engine.SubprocessEngine"
        ) as mock_subprocess:
            mock_delegate = AsyncMock()
            mock_subprocess.return_value = mock_delegate

            await engine.start()

            # Should have sent compile_start message
            mock_websocket.send_json.assert_any_call(
                {"type": "compile_start", "data": {"source": "test.waldiez"}}
            )

            # Should have called waldiez exporter
            mock_exporter.load.assert_called_once_with(sample_waldiez_file)
            mock_exporter_instance.export.assert_called_once()

            # Should have sent compile_end message
            mock_websocket.send_json.assert_any_call(
                {"type": "compile_end", "data": {"py": "test.py"}}
            )

            # Should have created subprocess engine
            mock_subprocess.assert_called_once()
            call_args = mock_subprocess.call_args
            assert call_args[1]["file_path"] == tmp_path / "test.py"
            assert call_args[1]["root_dir"] == tmp_path
            assert call_args[1]["websocket"] == mock_websocket

            # Should have started delegate
            mock_delegate.start.assert_called_once()
            start_args = mock_delegate.start.call_args[0][0]
            assert start_args["module"] == "waldiez"
            assert "run" in start_args["args"]
            assert "--file" in start_args["args"]
            assert "--output" in start_args["args"]
            assert "--force" in start_args["args"]
            assert "--structured" in start_args["args"]

            await engine.shutdown()


@pytest.mark.asyncio
async def test_waldiez_engine_start_with_step_mode(
    mock_websocket: AsyncMock,
    sample_waldiez_file: Path,
    tmp_path: Path,
) -> None:
    """Test waldiez engine start with step mode enabled."""
    engine = WaldiezEngine(
        file_path=sample_waldiez_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    with patch(
        "waldiez_studio.engines.waldiez_engine.WaldiezExporter"
    ) as mock_exporter:
        mock_exporter_instance = MagicMock()
        mock_exporter.load.return_value = mock_exporter_instance

        with patch(
            "waldiez_studio.engines.waldiez_engine.SubprocessEngine"
        ) as mock_subprocess:
            mock_delegate = AsyncMock()
            mock_subprocess.return_value = mock_delegate

            # Start with step mode
            await engine.start({"args": ["--step", "--verbose"]})

            # Should have added --step to args
            mock_delegate.start.assert_called_once()
            start_args = mock_delegate.start.call_args[0][0]
            assert "--step" in start_args["args"]

            await engine.shutdown()


@pytest.mark.asyncio
async def test_waldiez_engine_start_compilation_error(
    mock_websocket: AsyncMock,
    sample_waldiez_file: Path,
    tmp_path: Path,
) -> None:
    """Test waldiez engine handling compilation errors."""
    engine = WaldiezEngine(
        file_path=sample_waldiez_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    # Mock the waldiez exporter to raise an exception
    with patch(
        "waldiez_studio.engines.waldiez_engine.WaldiezExporter"
    ) as mock_exporter:
        mock_exporter.load.side_effect = ValueError("Invalid waldiez file")

        await engine.start()

        # Should have sent compile_start message
        mock_websocket.send_json.assert_any_call(
            {"type": "compile_start", "data": {"source": "test.waldiez"}}
        )

        # Should have sent compile_error message
        mock_websocket.send_json.assert_any_call(
            {
                "type": "compile_error",
                "data": {"message": "Invalid waldiez file"},
            }
        )

        # Should have sent run_end with error status
        mock_websocket.send_json.assert_any_call(
            {
                "type": "run_end",
                "data": {
                    "status": "error",
                    "returnCode": -1,
                    "elapsedMs": 0,
                },
            }
        )

        # Should not have created delegate
        assert engine._delegate is None


@pytest.mark.asyncio
async def test_waldiez_engine_handle_client_regular_message(
    mock_websocket: AsyncMock,
    sample_waldiez_file: Path,
    tmp_path: Path,
) -> None:
    """Test waldiez engine handling regular client messages."""
    engine = WaldiezEngine(
        file_path=sample_waldiez_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    # Create mock delegate
    mock_delegate = AsyncMock()
    engine._delegate = mock_delegate

    # Test regular message
    test_message = {"op": "interrupt"}

    with patch("builtins.print"):  # Suppress print output in tests
        await engine.handle_client(test_message)

    # Should have passed message directly to delegate
    mock_delegate.handle_client.assert_called_once_with(test_message)


@pytest.mark.asyncio
async def test_waldiez_engine_handle_client_waldiez_respond(
    mock_websocket: AsyncMock,
    sample_waldiez_file: Path,
    tmp_path: Path,
) -> None:
    """Test waldiez engine handling waldiez_respond messages."""
    engine = WaldiezEngine(
        file_path=sample_waldiez_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    # Create mock delegate
    mock_delegate = AsyncMock()
    engine._delegate = mock_delegate

    # Test waldiez_respond message
    test_message: dict[str, Any] = {
        "op": "waldiez_respond",
        "payload": {"action": "approve", "data": "test data"},
    }

    with patch("builtins.print"):  # Suppress print output in tests
        await engine.handle_client(test_message)

    # Should have converted payload to stdin message
    expected_stdin_message = {
        "op": "stdin",
        "text": json.dumps({"action": "approve", "data": "test data"}),
    }
    mock_delegate.handle_client.assert_called_once_with(expected_stdin_message)


@pytest.mark.asyncio
async def test_waldiez_engine_handle_client_waldiez_control(
    mock_websocket: AsyncMock,
    sample_waldiez_file: Path,
    tmp_path: Path,
) -> None:
    """Test waldiez engine handling waldiez_control messages."""
    engine = WaldiezEngine(
        file_path=sample_waldiez_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    # Create mock delegate
    mock_delegate = AsyncMock()
    engine._delegate = mock_delegate

    # Test waldiez_control message
    test_message: dict[str, Any] = {
        "op": "waldiez_control",
        "payload": {"command": "pause", "args": ["--timeout", "30"]},
    }

    with patch("builtins.print"):  # Suppress print output in tests
        await engine.handle_client(test_message)

    # Should have converted payload to stdin message
    expected_stdin_message = {
        "op": "stdin",
        "text": json.dumps({"command": "pause", "args": ["--timeout", "30"]}),
    }
    mock_delegate.handle_client.assert_called_once_with(expected_stdin_message)


@pytest.mark.asyncio
async def test_waldiez_engine_handle_client_waldiez_message_without_payload(
    mock_websocket: AsyncMock,
    sample_waldiez_file: Path,
    tmp_path: Path,
) -> None:
    """Test waldiez engine handling waldiez messages without payload."""
    engine = WaldiezEngine(
        file_path=sample_waldiez_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    # Create mock delegate
    mock_delegate = AsyncMock()
    engine._delegate = mock_delegate

    # Test waldiez_respond message without payload
    test_message = {"op": "waldiez_respond"}

    with patch("builtins.print"):  # Suppress print output in tests
        await engine.handle_client(test_message)

    # Should have passed message directly to delegate (no payload conversion)
    mock_delegate.handle_client.assert_called_once_with(test_message)


@pytest.mark.asyncio
async def test_waldiez_engine_handle_client_no_delegate(
    mock_websocket: AsyncMock,
    sample_waldiez_file: Path,
    tmp_path: Path,
) -> None:
    """Test waldiez engine handling client messages when no delegate exists."""
    engine = WaldiezEngine(
        file_path=sample_waldiez_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    # No delegate set
    assert engine._delegate is None

    # Test message handling - should not raise exception
    test_message = {"op": "interrupt"}

    with patch("builtins.print"):  # Suppress print output in tests
        await engine.handle_client(test_message)

    # Should complete without error


@pytest.mark.asyncio
async def test_waldiez_engine_shutdown(
    mock_websocket: AsyncMock,
    sample_waldiez_file: Path,
    tmp_path: Path,
) -> None:
    """Test waldiez engine shutdown process."""
    engine = WaldiezEngine(
        file_path=sample_waldiez_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    # Create mock delegate and task
    mock_delegate = AsyncMock()
    engine._delegate = mock_delegate

    async def dummy_task() -> None:
        await asyncio.sleep(0.1)

    engine._task = asyncio.create_task(dummy_task())

    await engine.shutdown()

    # Should have shutdown delegate
    mock_delegate.shutdown.assert_called_once()

    # Should have cancelled and cleared task
    assert engine._task is None


@pytest.mark.asyncio
async def test_waldiez_engine_shutdown_no_delegate_or_task(
    mock_websocket: AsyncMock,
    sample_waldiez_file: Path,
    tmp_path: Path,
) -> None:
    """Test waldiez engine shutdown when no delegate or task exists."""
    engine = WaldiezEngine(
        file_path=sample_waldiez_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    # No delegate or task
    assert engine._delegate is None
    assert engine._task is None

    # Should complete without error
    await engine.shutdown()


@pytest.mark.asyncio
async def test_waldiez_engine_compile_to_py(
    sample_waldiez_file: Path,
) -> None:
    """Test the _compile_to_py static method."""
    with patch(
        "waldiez_studio.engines.waldiez_engine.WaldiezExporter"
    ) as mock_exporter:
        mock_exporter_instance = MagicMock()
        mock_exporter.load.return_value = mock_exporter_instance

        result = await WaldiezEngine._compile_to_py(sample_waldiez_file)

        # Should have loaded the waldiez file
        mock_exporter.load.assert_called_once_with(sample_waldiez_file)

        # Should have exported to .py file
        expected_output = sample_waldiez_file.with_suffix(".py")
        mock_exporter_instance.export.assert_called_once_with(
            expected_output, force=True
        )

        # Should return the .py file path
        assert result == expected_output


@pytest.mark.asyncio
async def test_waldiez_engine_send_safe_success(
    mock_websocket: AsyncMock,
    sample_waldiez_file: Path,
    tmp_path: Path,
) -> None:
    """Test successful _send_safe method."""
    engine = WaldiezEngine(
        file_path=sample_waldiez_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    test_message: dict[str, Any] = {
        "type": "test",
        "data": {"message": "hello"},
    }

    await engine._send_safe(test_message)

    # Should have sent the message
    mock_websocket.send_json.assert_called_once_with(test_message)


@pytest.mark.asyncio
async def test_waldiez_engine_send_safe_exception(
    mock_websocket: AsyncMock,
    sample_waldiez_file: Path,
    tmp_path: Path,
) -> None:
    """Test _send_safe method when websocket raises exception."""
    engine = WaldiezEngine(
        file_path=sample_waldiez_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    # Make websocket raise exception
    mock_websocket.send_json.side_effect = Exception("Connection lost")

    test_message: dict[str, Any] = {
        "type": "test",
        "data": {"message": "hello"},
    }

    # Should not raise exception (should be suppressed)
    await engine._send_safe(test_message)

    # Should have attempted to send
    mock_websocket.send_json.assert_called_once_with(test_message)


@pytest.mark.asyncio
async def test_waldiez_engine_start_args_not_list(
    mock_websocket: AsyncMock,
    sample_waldiez_file: Path,
    tmp_path: Path,
) -> None:
    """Test waldiez engine start when args is not a list."""
    engine = WaldiezEngine(
        file_path=sample_waldiez_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    with patch(
        "waldiez_studio.engines.waldiez_engine.WaldiezExporter"
    ) as mock_exporter:
        mock_exporter_instance = MagicMock()
        mock_exporter.load.return_value = mock_exporter_instance

        with patch(
            "waldiez_studio.engines.waldiez_engine.SubprocessEngine"
        ) as mock_subprocess:
            mock_delegate = AsyncMock()
            mock_subprocess.return_value = mock_delegate

            # Start with args as string instead of list
            await engine.start({"args": "--step --verbose"})

            # Should not have added --step to args (since args is not a list)
            mock_delegate.start.assert_called_once()
            start_args = mock_delegate.start.call_args[0][0]
            assert "--step" not in start_args["args"]

            await engine.shutdown()
