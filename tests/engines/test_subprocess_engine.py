# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# pyright: reportPrivateUsage=false
# pylint: disable=missing-function-docstring,protected-access
# pylint: disable=missing-return-doc,missing-param-doc,line-too-long
"""Tests for subprocess engine."""

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from waldiez_studio.engines.subprocess_engine import SubprocessEngine


@pytest.fixture(name="mock_websocket")
def mock_websocket_fixture() -> MagicMock:
    """Create a mock websocket."""
    websocket = MagicMock()
    websocket.send = AsyncMock()
    websocket.send_json = AsyncMock()
    return websocket


@pytest.fixture(name="temp_python_file")
def temp_python_file_fixture(tmp_path: Path) -> Path:
    """Create a temporary Python file for testing."""
    test_file = tmp_path / "test.py"
    test_file.write_text("print('Hello, World!')")
    return test_file


@pytest.mark.asyncio
async def test_subprocess_engine_start(
    mock_websocket: MagicMock,
    temp_python_file: Path,
    tmp_path: Path,
) -> None:
    """Test basic subprocess engine start functionality."""
    engine = SubprocessEngine(
        file_path=temp_python_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    with patch("asyncio.create_subprocess_exec") as mock_subprocess:
        mock_proc = AsyncMock()
        mock_proc.pid = 12345
        mock_proc.stdout = AsyncMock()
        mock_proc.stderr = AsyncMock()
        mock_proc.returncode = None

        # Mock read to return empty bytes (EOF)
        mock_proc.stdout.read.return_value = b""
        mock_proc.stderr.read.return_value = b""

        mock_subprocess.return_value = mock_proc
        mock_proc.wait.return_value = 0

        await engine.start()
        await asyncio.sleep(0.2)

        # Should have called subprocess creation
        mock_subprocess.assert_called_once()

        # Should have sent started status
        mock_websocket.send_json.assert_called()
        types = [
            c.args[0]["type"] for c in mock_websocket.send_json.call_args_list
        ]
        assert "run_status" in types
        # Cleanup
        await engine.shutdown()


@pytest.mark.asyncio
async def test_subprocess_engine_handle_stdin(
    mock_websocket: MagicMock,
    temp_python_file: Path,
    tmp_path: Path,
) -> None:
    """Test stdin handling."""
    engine = SubprocessEngine(
        file_path=temp_python_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    mock_proc = MagicMock()
    mock_stdin = MagicMock()
    mock_stdin.is_closing.return_value = False
    mock_stdin.write = MagicMock()
    mock_stdin.drain = AsyncMock()
    mock_proc.stdin = mock_stdin

    engine.proc = mock_proc

    # Test stdin message
    await engine.handle_client({"op": "stdin", "text": "test input\n"})

    await asyncio.sleep(0.2)

    mock_stdin.write.assert_called_with(b"test input\n")
    mock_stdin.drain.assert_called_once()


@pytest.mark.asyncio
async def test_subprocess_engine_handle_interrupt_unix(
    mock_websocket: MagicMock,
    temp_python_file: Path,
    tmp_path: Path,
) -> None:
    """Test interrupt signal handling."""
    engine = SubprocessEngine(
        file_path=temp_python_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    mock_proc = AsyncMock()
    mock_proc.pid = 12345
    engine.proc = mock_proc
    with (
        patch.object(sys, "platform", "linux"),
        patch("os.getpgid", create=True) as mock_getpgid,
        patch("os.killpg", create=True) as mock_killpg,
    ):
        mock_getpgid.return_value = 999
        await engine.handle_client({"op": "interrupt"})

        mock_getpgid.assert_called_once_with(mock_proc.pid)
        mock_killpg.assert_called_once()
        mock_proc.terminate.assert_not_called()


@pytest.mark.asyncio
async def test_processlookuperror_is_swallowed(
    mock_websocket: MagicMock,
    temp_python_file: Path,
    tmp_path: Path,
) -> None:
    engine = SubprocessEngine(
        file_path=temp_python_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )
    mock_proc = AsyncMock()
    mock_proc.pid = 12345
    engine.proc = mock_proc

    with (
        patch.object(sys, "platform", "linux"),
        patch("os.getpgid", create=True) as mock_getpgid,
        patch("os.killpg", create=True) as mock_killpg,
    ):
        mock_getpgid.side_effect = ProcessLookupError
        # Should not raise
        await engine.handle_client({"op": "interrupt"})

        mock_getpgid.assert_called_once_with(mock_proc.pid)
        mock_killpg.assert_not_called()
        mock_proc.terminate.assert_not_called()


@pytest.mark.asyncio
async def test_subprocess_engine_shutdown(
    mock_websocket: MagicMock,
    temp_python_file: Path,
    tmp_path: Path,
) -> None:
    """Test engine shutdown process."""
    engine = SubprocessEngine(
        file_path=temp_python_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    # Setup mock process
    mock_proc = AsyncMock()
    mock_proc.returncode = 0
    mock_proc.wait.return_value = 0
    engine.proc = mock_proc

    async def dummy_task() -> None:
        await asyncio.sleep(0)

    engine._monitor_tasks = [asyncio.create_task(dummy_task())]

    await engine.shutdown()
    await asyncio.sleep(0.2)

    # Should have sent run_end message
    mock_websocket.send_json.assert_called()
    # Check that one of the calls was run_end
    calls = [call[0][0] for call in mock_websocket.send_json.call_args_list]
    run_end_calls = [call for call in calls if call.get("type") == "run_end"]
    assert len(run_end_calls) > 0
    assert run_end_calls[0]["data"]["status"] == "ok"


@pytest.mark.asyncio
async def test_subprocess_engine_with_venv(
    mock_websocket: MagicMock,
    temp_python_file: Path,
    tmp_path: Path,
) -> None:
    """Test subprocess engine with virtual environment."""
    # Create mock venv structure
    venv_path = tmp_path / "venv"
    venv_bin = (
        venv_path / "Scripts" if sys.platform == "win32" else venv_path / "bin"
    )
    venv_bin.mkdir(parents=True)
    python_exe = (
        venv_bin / "python.exe"
        if sys.platform == "win32"
        else venv_bin / "python"
    )
    python_exe.write_text("#!/usr/bin/env python")
    python_exe.chmod(0o755)

    engine = SubprocessEngine(
        file_path=temp_python_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    with patch("asyncio.create_subprocess_exec") as mock_subprocess:
        mock_proc = AsyncMock()
        mock_proc.pid = 12345
        mock_proc.stdout = AsyncMock()
        mock_proc.stderr = AsyncMock()
        mock_proc.stdout.read.return_value = b""
        mock_proc.stderr.read.return_value = b""
        mock_subprocess.return_value = mock_proc

        # Start with venv
        await engine.start({"venv": str(venv_path)})

        # Should have used venv python
        mock_subprocess.assert_called_once()
        call_args = mock_subprocess.call_args[0]
        assert str(venv_path) in call_args[0]  # First arg should be python path

        await engine.shutdown()


@pytest.mark.asyncio
async def test_subprocess_engine_start_with_module(
    mock_websocket: MagicMock,
    temp_python_file: Path,
    tmp_path: Path,
) -> None:
    """Test subprocess engine start with module parameter."""
    engine = SubprocessEngine(
        file_path=temp_python_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    with patch("asyncio.create_subprocess_exec") as mock_subprocess:
        mock_proc = AsyncMock()
        mock_proc.pid = 12345
        mock_proc.stdout = AsyncMock()
        mock_proc.stderr = AsyncMock()
        mock_proc.stdout.read.return_value = b""
        mock_proc.stderr.read.return_value = b""
        mock_subprocess.return_value = mock_proc
        mock_proc.wait.return_value = 0

        # Start with module
        await engine.start({"module": "test_module", "args": ["--verbose"]})

        # Should have called with -m module
        mock_subprocess.assert_called_once()
        call_args = mock_subprocess.call_args[0]
        assert "-m" in call_args
        assert "test_module" in call_args
        assert "--verbose" in call_args

        await engine.shutdown()


@pytest.mark.asyncio
async def test_subprocess_engine_start_with_cwd(
    mock_websocket: MagicMock,
    temp_python_file: Path,
    tmp_path: Path,
) -> None:
    """Test subprocess engine start with custom working directory."""
    engine = SubprocessEngine(
        file_path=temp_python_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    subdir = tmp_path / "subdir"
    subdir.mkdir()

    with patch("asyncio.create_subprocess_exec") as mock_subprocess:
        mock_proc = AsyncMock()
        mock_proc.pid = 12345
        mock_proc.stdout = AsyncMock()
        mock_proc.stderr = AsyncMock()
        mock_proc.stdout.read.return_value = b""
        mock_proc.stderr.read.return_value = b""
        mock_subprocess.return_value = mock_proc
        mock_proc.wait.return_value = 0

        # Start with custom cwd
        await engine.start({"cwd": "subdir"})

        # Should have called with custom cwd
        mock_subprocess.assert_called_once()
        kwargs = mock_subprocess.call_args[1]
        assert str(subdir) in kwargs["cwd"]

        await engine.shutdown()


@pytest.mark.asyncio
async def test_subprocess_engine_handle_stdin_without_newline(
    mock_websocket: MagicMock,
    temp_python_file: Path,
    tmp_path: Path,
) -> None:
    """Test stdin handling when text doesn't end with newline."""
    engine = SubprocessEngine(
        file_path=temp_python_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    mock_proc = MagicMock()
    mock_stdin = MagicMock()
    mock_stdin.is_closing.return_value = False
    mock_stdin.write = MagicMock()
    mock_stdin.drain = AsyncMock()
    mock_proc.stdin = mock_stdin

    engine.proc = mock_proc

    # Test stdin message without newline
    await engine.handle_client({"op": "stdin", "text": "test input"})

    # Should have added newline
    mock_stdin.write.assert_called_with(b"test input\n")


@pytest.mark.asyncio
async def test_subprocess_engine_handle_stdin_eof(
    mock_websocket: MagicMock,
    temp_python_file: Path,
    tmp_path: Path,
) -> None:
    """Test stdin EOF handling."""
    engine = SubprocessEngine(
        file_path=temp_python_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    mock_proc = MagicMock()
    mock_stdin = MagicMock()
    mock_stdin.is_closing.return_value = False
    mock_stdin.write_eof = MagicMock()
    mock_proc.stdin = mock_stdin

    engine.proc = mock_proc

    # Test stdin_eof message
    await engine.handle_client({"op": "stdin_eof"})

    mock_stdin.write_eof.assert_called_once()


@pytest.mark.asyncio
async def test_subprocess_engine_handle_terminate(
    mock_websocket: MagicMock,
    temp_python_file: Path,
    tmp_path: Path,
) -> None:
    """Test terminate signal handling."""
    engine = SubprocessEngine(
        file_path=temp_python_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    mock_proc = AsyncMock()
    mock_proc.pid = 12345
    engine.proc = mock_proc

    with (
        patch("os.getpgid", create=True),
        patch("os.killpg", create=True) as mock_killpg,
        patch("sys.platform", "linux"),
    ):
        # Test terminate
        await engine.handle_client({"op": "terminate"})

        # Should have called killpg with SIGTERM
        mock_killpg.assert_called_once()


@pytest.mark.asyncio
async def test_subprocess_engine_handle_kill(
    mock_websocket: MagicMock,
    temp_python_file: Path,
    tmp_path: Path,
) -> None:
    """Test kill signal handling."""
    engine = SubprocessEngine(
        file_path=temp_python_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    mock_proc = AsyncMock()
    mock_proc.pid = 12345
    engine.proc = mock_proc

    with (
        patch("os.getpgid", create=True),
        patch("os.killpg", create=True) as mock_killpg,
        patch("sys.platform", "linux"),
    ):
        # Test kill
        await engine.handle_client({"op": "kill"})

        # Should have called killpg with SIGKILL
        mock_killpg.assert_called_once()


@pytest.mark.asyncio
async def test_subprocess_engine_shutdown_timeout(
    mock_websocket: MagicMock,
    temp_python_file: Path,
    tmp_path: Path,
) -> None:
    """Test shutdown with process timeout and escalation."""
    engine = SubprocessEngine(
        file_path=temp_python_file,
        root_dir=tmp_path,
        websocket=mock_websocket,
    )

    mock_proc = AsyncMock()
    mock_proc.returncode = None

    # Mock wait to timeout twice, then succeed
    mock_proc.wait.side_effect = [
        asyncio.TimeoutError(),  # First timeout (wait)
        asyncio.TimeoutError(),  # Second timeout (after terminate)
        0,  # Finally succeed after kill
    ]

    engine.proc = mock_proc
    engine._did_end = False
    engine._start_ts = 0.0

    with (
        patch.object(engine, "_terminate") as mock_terminate,
        patch.object(engine, "_kill") as mock_kill,
    ):
        await engine.shutdown()

        # Should have tried terminate and kill
        mock_terminate.assert_called_once()
        mock_kill.assert_called_once()
