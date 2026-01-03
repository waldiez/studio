# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2026 Waldiez and contributors.

# pyright: reportPrivateUsage=false
# pylint: disable=missing-function-docstring,protected-access
# pylint: disable=missing-return-doc,missing-param-doc,line-too-long
"""Tests for notebook engine."""

import asyncio
import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from waldiez_studio.engines.notebook_engine import NotebookEngine


@pytest.fixture(name="mock_websocket")
def mock_websocket_fixture() -> MagicMock:
    """Create a mock websocket."""
    websocket = MagicMock()
    websocket.send = AsyncMock()
    websocket.send_json = AsyncMock()
    return websocket


@pytest.fixture(name="sample_notebook")
def sample_notebook_fixture(tmp_path: Path) -> Path:
    """Create a sample notebook file."""
    notebook_content: dict[str, Any] = {
        "cells": [
            {"cell_type": "code", "source": ["print('Hello, World!')"]},
            {"cell_type": "markdown", "source": ["# This is markdown"]},
            {"cell_type": "code", "source": ["x = 5\n", "print(x * 2)"]},
        ],
        "metadata": {},
        "nbformat": 4,
        "nbformat_minor": 2,
    }

    nb_file = tmp_path / "test.ipynb"
    nb_file.write_text(json.dumps(notebook_content))
    return nb_file


@pytest.mark.asyncio
async def test_notebook_engine_initialization(
    mock_websocket: MagicMock,
    sample_notebook: Path,
    tmp_path: Path,
) -> None:
    """Test notebook engine initialization."""
    engine = NotebookEngine(
        file_path=sample_notebook,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    assert engine.file_path == sample_notebook
    assert engine.root_dir == tmp_path
    assert engine.websocket == mock_websocket
    assert engine.max_queue == 1000
    assert engine.exec_timeout_sec == 120.0


@pytest.mark.asyncio
async def test_notebook_engine_start(
    mock_websocket: MagicMock,
    sample_notebook: Path,
    tmp_path: Path,
) -> None:
    """Test notebook engine start process."""
    engine = NotebookEngine(
        file_path=sample_notebook,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    with patch(
        "waldiez_studio.engines.notebook_engine.KernelManager"
    ) as mock_kernel:
        mock_km = MagicMock()
        mock_kc = MagicMock()
        mock_kc.wait_for_ready = AsyncMock()
        mock_km.client.return_value = mock_kc
        mock_kernel.get = AsyncMock(return_value=mock_km)
        mock_kernel.shutdown_kernel = AsyncMock()
        mock_kernel.lock.return_value = AsyncMock()

        # Mock the shell reply
        mock_kc.shell_channel.get_msg.return_value = {
            "content": {"status": "ok"}
        }

        await engine.start()
        await asyncio.sleep(0.2)

        mock_kernel.get.assert_called_once()
        mock_kc.start_channels.assert_called_once()
        mock_kc.wait_for_ready.assert_called_once()
        mock_websocket.send_json.assert_called()

        await engine.shutdown()


@pytest.mark.asyncio
async def test_notebook_engine_handle_interrupt(
    mock_websocket: MagicMock,
    sample_notebook: Path,
    tmp_path: Path,
) -> None:
    """Test notebook engine interrupt handling."""
    engine = NotebookEngine(
        file_path=sample_notebook,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    with patch(
        "waldiez_studio.engines.notebook_engine.KernelManager"
    ) as mock_kernel:
        mock_kernel.interrupt = AsyncMock()
        mock_kc = AsyncMock()
        engine.kc = mock_kc

        await engine.handle_client({"op": "interrupt"})
        await asyncio.sleep(0.2)

        # Should have called interrupt
        mock_kernel.interrupt.assert_called_once()


@pytest.mark.asyncio
async def test_notebook_engine_handle_restart(
    mock_websocket: MagicMock,
    sample_notebook: Path,
    tmp_path: Path,
) -> None:
    """Test notebook engine restart handling."""
    engine = NotebookEngine(
        file_path=sample_notebook,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    with patch(
        "waldiez_studio.engines.notebook_engine.KernelManager"
    ) as mock_kernel:
        mock_kc = MagicMock()
        mock_kc.wait_for_ready = AsyncMock()
        mock_kernel.restart = AsyncMock()
        mock_kernel.shutdown_kernel = AsyncMock()
        engine.kc = mock_kc

        await engine.handle_client({"op": "restart"})

        # Should have called restart and restarted channels
        mock_kernel.restart.assert_called_once()
        mock_kc.stop_channels.assert_called_once()
        mock_kc.start_channels.assert_called_once()


@pytest.mark.asyncio
async def test_notebook_engine_shutdown(
    mock_websocket: MagicMock,
    sample_notebook: Path,
    tmp_path: Path,
) -> None:
    """Test notebook engine shutdown process."""

    engine = NotebookEngine(
        file_path=sample_notebook,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    async def dummy_task() -> None:
        await asyncio.sleep(0)

    with patch(
        "waldiez_studio.engines.notebook_engine.KernelManager"
    ) as mock_kernel:
        mock_km = MagicMock()
        mock_kc = MagicMock()
        mock_kc.stop_channels = MagicMock()
        mock_kc.wait_for_ready = AsyncMock()
        mock_km.client.return_value = mock_kc
        mock_kernel.get = AsyncMock(return_value=mock_km)
        mock_kernel.shutdown_kernel = AsyncMock()
        mock_kernel.lock.return_value = AsyncMock()

        engine._monitor_tasks = [asyncio.create_task(dummy_task())]
        engine.kc = mock_kc
        await engine.shutdown()

    await asyncio.sleep(0.2)
    # Should have stopped channels
    mock_kc.stop_channels.assert_called_once()

    # Should have sent run_end message
    mock_websocket.send_json.assert_called()


@pytest.mark.asyncio
async def test_notebook_engine_invalid_notebook(
    mock_websocket: MagicMock,
    tmp_path: Path,
) -> None:
    """Test handling of invalid notebook file."""
    # Create invalid notebook file
    invalid_nb = tmp_path / "invalid.ipynb"
    invalid_nb.write_text("invalid json content")

    engine = NotebookEngine(
        file_path=invalid_nb,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    with patch(
        "waldiez_studio.engines.notebook_engine.KernelManager"
    ) as mock_kernel:
        mock_km = MagicMock()
        mock_kc = MagicMock()
        mock_kc.wait_for_ready = AsyncMock()
        mock_km.client.return_value = mock_kc
        mock_kernel.get = AsyncMock(return_value=mock_km)
        mock_kernel.shutdown_kernel = AsyncMock()
        mock_kernel.lock.return_value = AsyncMock()

        await engine.start()
        await asyncio.sleep(0.2)

        # Should have sent error message
        mock_websocket.send_json.assert_called()
        # Check if any call had an error message
        calls = [c[0][0] for c in mock_websocket.send_json.call_args_list]
        error_calls = [
            call for call in calls if call.get("type") == "run_stderr"
        ]
        assert len(error_calls) > 0

        await engine.shutdown()


@pytest.mark.asyncio
async def test_notebook_engine_fresh_kernel(
    mock_websocket: MagicMock,
    sample_notebook: Path,
    tmp_path: Path,
) -> None:
    """Test starting notebook engine with fresh kernel option."""
    engine = NotebookEngine(
        file_path=sample_notebook,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    with patch(
        "waldiez_studio.engines.notebook_engine.KernelManager"
    ) as mock_kernel:
        mock_km = MagicMock()
        mock_kc = MagicMock()
        mock_kc.wait_for_ready = AsyncMock()
        mock_km.client.return_value = mock_kc
        mock_kernel.get = AsyncMock(return_value=mock_km)
        mock_kernel.shutdown_kernel = AsyncMock()
        mock_kernel.lock.return_value = AsyncMock()

        mock_kc.shell_channel.get_msg.return_value = {
            "content": {"status": "ok"}
        }
        # Start with fresh kernel
        await engine.start({"freshKernel": True})

        await asyncio.sleep(0.2)

        # Should have shutdown existing kernel first
        mock_kernel.shutdown_kernel.assert_called_once_with(now=True)

        await engine.shutdown()


@pytest.mark.asyncio
async def test_notebook_engine_execution_timeout(
    mock_websocket: MagicMock,
    sample_notebook: Path,
    tmp_path: Path,
) -> None:
    """Test notebook engine execution timeout handling."""
    engine = NotebookEngine(
        file_path=sample_notebook,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )
    engine.exec_timeout_sec = 0.1  # Very short timeout for testing

    with patch(
        "waldiez_studio.engines.notebook_engine.KernelManager"
    ) as mock_kernel:
        mock_km = MagicMock()
        mock_kc = MagicMock()
        mock_kc.wait_for_ready = AsyncMock()
        mock_km.client.return_value = mock_kc
        mock_kernel.get = AsyncMock(return_value=mock_km)
        mock_kernel.shutdown_kernel = AsyncMock()
        mock_kernel.interrupt = AsyncMock()
        lock_mock = AsyncMock()
        lock_mock.__aenter__ = AsyncMock()
        lock_mock.__aexit__ = AsyncMock()
        mock_kernel.lock.return_value = lock_mock

        # Mock execute to simulate timeout
        mock_kc.execute = MagicMock()

        # Create a coroutine that never completes (simulates timeout)
        async def never_complete() -> str:
            await asyncio.sleep(1)  # Longer than timeout
            return "ok"

        engine._wait_shell_reply = AsyncMock(  # type: ignore[method-assign]
            side_effect=never_complete,
        )

        await engine.start()
        await asyncio.sleep(0.3)

        # Should have called interrupt due to timeout
        mock_kernel.interrupt.assert_called()

        await engine.shutdown()


@pytest.mark.asyncio
async def test_notebook_engine_execution_exception(
    mock_websocket: MagicMock,
    sample_notebook: Path,
    tmp_path: Path,
) -> None:
    """Test notebook engine execution exception handling."""
    engine = NotebookEngine(
        file_path=sample_notebook,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    with patch(
        "waldiez_studio.engines.notebook_engine.KernelManager"
    ) as mock_kernel:
        mock_km = MagicMock()
        mock_kc = MagicMock()
        mock_kc.wait_for_ready = AsyncMock()
        mock_km.client.return_value = mock_kc
        mock_kernel.get = AsyncMock(return_value=mock_km)
        mock_kernel.shutdown_kernel = AsyncMock()
        lock_mock = AsyncMock()
        lock_mock.__aenter__ = AsyncMock()
        lock_mock.__aexit__ = AsyncMock()
        mock_kernel.lock.return_value = lock_mock

        # Mock execute to raise exception
        mock_kc.execute = MagicMock(
            side_effect=RuntimeError("Execution failed")
        )

        await engine.start()
        await asyncio.sleep(0.2)

        # Should have sent error message
        mock_websocket.send_json.assert_called()
        calls = [c[0][0] for c in mock_websocket.send_json.call_args_list]
        error_calls = [
            call for call in calls if call.get("type") == "run_stderr"
        ]
        assert len(error_calls) > 0

        await engine.shutdown()


@pytest.mark.asyncio
async def test_notebook_engine_input_reply(
    mock_websocket: MagicMock,
    sample_notebook: Path,
    tmp_path: Path,
) -> None:
    """Test notebook engine input reply handling."""
    engine = NotebookEngine(
        file_path=sample_notebook,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    mock_kc = MagicMock()
    mock_kc.input = MagicMock()
    engine.kc = mock_kc

    await engine.handle_client({"op": "input_reply", "value": "test input"})

    mock_kc.input.assert_called_once_with("test input")


@pytest.mark.asyncio
async def test_notebook_engine_forward_iopub_display_data(
    mock_websocket: MagicMock,
    sample_notebook: Path,
    tmp_path: Path,
) -> None:
    """Test forwarding display_data messages."""
    engine = NotebookEngine(
        file_path=sample_notebook,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )
    engine._queue = asyncio.Queue()

    # Test display_data with image
    display_msg: dict[str, Any] = {
        "header": {"msg_type": "display_data"},
        "content": {
            "data": {
                "image/png": "base64image-data",
                "text/plain": "<matplotlib figure>",
            }
        },
    }

    await engine._enqueue(display_msg)

    # Verify message was queued
    assert not engine._queue.empty()


@pytest.mark.asyncio
async def test_notebook_engine_forward_iopub_error(
    mock_websocket: MagicMock,
    sample_notebook: Path,
    tmp_path: Path,
) -> None:
    """Test forwarding error messages."""
    engine = NotebookEngine(
        file_path=sample_notebook,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )
    engine._queue = asyncio.Queue()

    # Test error message
    error_msg: dict[str, Any] = {
        "header": {"msg_type": "error"},
        "content": {
            "traceback": [
                "Traceback (most recent call last):",
                "  File ...",
                "ValueError: test error",
            ]
        },
    }

    await engine._enqueue(error_msg)

    # Verify message was queued
    assert not engine._queue.empty()
