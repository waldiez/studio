# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.
# flake8: noqa
# pyright: reportFunctionMemberAccess=false,reportPrivateUsage=false
# pylint: disable=missing-function-docstring,missing-return-doc,
# pylint: disable=missing-yield-doc,missing-param-doc,missing-raises-doc
# pylint: disable=no-member,protected-access,unused-argument,redefined-variable-type

"""Tests for waldiez_studio.utils.task_runner."""

import asyncio
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from waldiez_studio.utils.task_runner import TaskRunner, run_task
from waldiez_studio.utils.task_state import TaskState


@pytest.fixture(name="fake_websocket")
def fake_websocket_fixture() -> MagicMock:
    ws = AsyncMock()
    ws.receive_json = AsyncMock(
        side_effect=[
            {"action": "status"},
            {"action": "start"},
            {"action": "stop"},
            {"action": "unknown"},
            asyncio.CancelledError(),
        ]
    )
    return ws


@pytest.mark.asyncio
async def test_task_runner_listen_handles_actions(
    fake_websocket: MagicMock,
) -> None:
    task_runner = TaskRunner(task_id="test-id", websocket=fake_websocket)

    with (
        patch.object(
            task_runner, "_handle_start", new=AsyncMock()
        ) as mock_start,
        patch.object(task_runner, "_handle_stop", new=AsyncMock()) as mock_stop,
        patch.object(task_runner, "send_message", new=AsyncMock()),
    ):
        with pytest.raises(asyncio.CancelledError):
            await task_runner.listen()

        assert mock_start.call_count == 1
        assert mock_stop.call_count == 1
        task_runner.send_message.assert_called_with(  # type: ignore
            "status", "NOT_STARTED"
        )


@pytest.mark.asyncio
async def test_task_runner_handle_start_sets_state(
    fake_websocket: MagicMock,
) -> None:
    """Test that _handle_start sets the task state correctly."""
    task_runner = TaskRunner("task-id", fake_websocket)
    task_runner.task_state = TaskState.NOT_STARTED

    with patch.object(task_runner, "run", new=AsyncMock()) as mock_run:
        await task_runner._handle_start()
        mock_run.assert_called_once()
        assert (
            task_runner.task_state == TaskState.NOT_STARTED
        )  # Set right before run()


@pytest.mark.asyncio
async def test_task_runner_handle_stop_when_running(
    fake_websocket: MagicMock,
) -> None:
    """Test that _handle_stop stops the task when it is running."""
    task_runner = TaskRunner("task-id", fake_websocket)
    task_runner.task_state = TaskState.RUNNING

    dummy_task = asyncio.create_task(asyncio.sleep(5))
    task_runner.running_task = dummy_task
    task_runner.comm_handler_task = asyncio.create_task(asyncio.sleep(5))

    with patch.object(task_runner, "send_message", new=AsyncMock()):
        await task_runner.stop_task()

        assert task_runner.task_state == TaskState.COMPLETED
        task_runner.send_message.assert_called_with(  # type: ignore
            "info", "Task stopped."
        )


@pytest.mark.asyncio
async def test_run_task_and_cleanup_called(fake_websocket: MagicMock) -> None:
    task_runner = TaskRunner("task-id", fake_websocket)
    task_runner.task_state = TaskState.NOT_STARTED

    with (
        patch(
            "waldiez_studio.utils.task_runner.run_task", return_value=["result"]
        ) as mock_run_task,
        patch(
            "waldiez_studio.utils.task_runner.serialize_results",
            return_value={"ok": True},
        ),
        patch.object(
            task_runner, "_handle_thread_communication", new=AsyncMock()
        ),
        patch.object(fake_websocket, "send_json", new=AsyncMock()),
    ):
        await task_runner.run()
        mock_run_task.assert_called_once()
        assert task_runner.task_state == TaskState.COMPLETED


@pytest.mark.asyncio
async def test_handle_user_response_sets_future_result(
    fake_websocket: MagicMock,
    tmp_path: Path,
) -> None:
    """Test that a valid user response sets the future result."""
    task_runner = TaskRunner("task-id", fake_websocket)
    future = task_runner.loop.create_future()
    task_runner.pending_inputs["abc"] = future

    response_data: dict[str, Any] = {
        "request_id": "abc",
        "data": [{"type": "text", "text": "hello"}],
        "password": False,
    }
    with patch(
        "waldiez_studio.utils.task_runner.id_to_path", return_value=tmp_path
    ):
        task_runner._handle_user_response(response_data)

    assert future.done()
    assert future.result() == "hello"


@pytest.mark.asyncio
async def test_handle_start_when_running_sends_info(
    fake_websocket: MagicMock,
) -> None:
    """Test that _handle_start sends info when task is already running."""
    task_runner = TaskRunner("task-id", fake_websocket)
    task_runner.task_state = TaskState.RUNNING

    with patch.object(task_runner, "send_message", new=AsyncMock()) as mock_msg:
        await task_runner._handle_start()
        mock_msg.assert_called_once_with("info", "Task is already running.")


@pytest.mark.asyncio
async def test_handle_stop_when_not_running_sends_info(
    fake_websocket: MagicMock,
) -> None:
    """Test that _handle_stop sends info if task is not running."""
    task_runner = TaskRunner("task-id", fake_websocket)
    task_runner.task_state = TaskState.NOT_STARTED  # or COMPLETED

    with (
        patch.object(task_runner, "send_message", new=AsyncMock()) as mock_msg,
        patch.object(task_runner, "stop_task", new=AsyncMock()) as mock_stop,
    ):
        await task_runner._handle_stop()

        mock_stop.assert_not_called()
        mock_msg.assert_called_once_with("info", "No running task to stop.")


@pytest.mark.asyncio
async def test_run_early_exits_if_already_running_or_completed(
    fake_websocket: MagicMock,
) -> None:
    """Test that run() exits early if task is already running or completed."""
    task_runner = TaskRunner("task-id", fake_websocket)

    # Already running
    task_runner.task_state = TaskState.RUNNING
    with patch.object(task_runner, "send_message", new=AsyncMock()) as mock_msg:
        await task_runner.run()
        mock_msg.assert_called_once_with("info", "Task is already running.")

    # Already completed
    task_runner.task_state = TaskState.COMPLETED
    with patch.object(task_runner, "send_message", new=AsyncMock()) as mock_msg:
        await task_runner.run()
        mock_msg.assert_called_once_with("info", "Task is already completed.")


@pytest.mark.asyncio
async def test_handle_user_response_invalid_data_logs_error(
    fake_websocket: MagicMock,
    tmp_path: Path,
) -> None:
    """Test that invalid user response logs validation error."""
    task_runner = TaskRunner("task-id", fake_websocket)

    with (
        patch(
            "waldiez_studio.utils.task_runner.id_to_path",
            return_value=tmp_path,
        ),
        patch("waldiez_studio.utils.task_runner.LOG.error") as mock_error,
    ):
        task_runner._handle_user_response({"type": "other", "other": {}})
        expected = "Validation error for user response"
        captured = mock_error.call_args[0][0]
        assert expected in captured, f"Expected '{expected}' in '{captured}'"


@pytest.mark.asyncio
async def test_send_input_request_returns_user_input(
    fake_websocket: MagicMock,
) -> None:
    """Test that _send_input_request returns the user input."""
    fake_websocket.send_json = AsyncMock()

    task_runner = TaskRunner("task-id", fake_websocket)

    # Start task — allow coroutine to run up to await
    coro = asyncio.create_task(
        task_runner._send_input_request("What's your name?")
    )

    # Wait until pending_inputs has been populated
    await asyncio.sleep(0)

    assert len(task_runner.pending_inputs) == 1
    request_id, future = next(iter(task_runner.pending_inputs.items()))

    future.set_result("Waldo")
    result = await coro

    assert result == "Waldo"
    assert request_id not in task_runner.pending_inputs


@pytest.mark.asyncio
async def test_send_input_request_timeout_logs_and_returns_empty(
    fake_websocket: MagicMock,
) -> None:
    """Test that _send_input_request handles timeout gracefully."""
    task_runner = TaskRunner("task-id", fake_websocket)
    task_runner.input_timeout = 0.01  # fast timeout

    fake_websocket.send_json = AsyncMock()
    with patch("waldiez_studio.utils.task_runner.LOG.warning") as mock_warning:
        result = await task_runner._send_input_request("What's your name?")
        assert result == ""
        mock_warning.assert_called_once_with(
            "Input request timed out after %.1f seconds.",
            task_runner.input_timeout,
        )


@pytest.mark.asyncio
async def test_send_output_replaces_placeholders(
    fake_websocket: MagicMock,
) -> None:
    """Test that _send_output replaces image placeholders."""
    task_runner = TaskRunner("abc123", fake_websocket)
    task_runner.latest_request_id = "imagefile"

    with (
        patch(
            "waldiez_studio.utils.task_runner.get_root_dir",
            return_value="/workspace",
        ),
        patch(
            "waldiez_studio.utils.task_runner.id_to_path",
            return_value=Path("/workspace/abc123.json"),
        ),
    ):
        await task_runner._send_output("hello <image>!")

    fake_websocket.send_json.assert_called_once()
    result = fake_websocket.send_json.call_args[0][0]
    assert result["type"] == "print"
    assert "/download?path=" in result["data"]


@pytest.mark.asyncio
async def test_thread_safe_callbacks_send_output_and_input(
    fake_websocket: MagicMock,
) -> None:
    """Test on_output and on_input triggers callbacks."""
    task_runner = TaskRunner("task-id", fake_websocket)

    with patch.object(
        task_runner, "_send_input_request", new=AsyncMock(return_value="yes!")
    ):
        on_input, on_output = task_runner._create_thread_safe_callbacks()

        # run input from thread
        result = await asyncio.to_thread(on_input, "prompt")
        assert result == "yes!"

        # output gets queued
        on_output("A", "B", sep="-", end="!")
        queued = await task_runner.output_messages.get()
        assert queued == "A-B!"


@pytest.mark.asyncio
async def test_thread_communication_sends_output(
    fake_websocket: MagicMock,
) -> None:
    """Test that messages are sent if queue is not empty."""
    task_runner = TaskRunner("task-id", fake_websocket)
    task_runner.stop_event.clear()

    task_runner.output_messages.put_nowait("from queue")
    fake_websocket.send_json = AsyncMock()

    async def stop_soon() -> None:
        """Stop the task runner after a short delay."""
        await asyncio.sleep(0.02)
        task_runner.stop_event.set()

    await asyncio.gather(
        task_runner._handle_thread_communication(),
        stop_soon(),
    )

    fake_websocket.send_json.assert_called_once()
    assert fake_websocket.send_json.call_args[0][0]["data"].startswith(
        "from queue"
    )


def test_run_task_success(tmp_path: Path) -> None:
    """Test run_task completes successfully with mocked runner."""
    mock_runner = MagicMock()
    mock_runner.is_async = False
    mock_runner.run.return_value = "done"

    file_path = tmp_path / "abc123.json"
    file_path.write_text("{}")  # just to exist

    # noinspection PyUnusedLocal
    def mock_on_input(prompt: str, **kwargs: Any) -> str:
        return "yes"

    with (
        patch(
            "waldiez_studio.utils.task_runner.id_to_path",
            return_value=file_path,
        ),
        patch(
            "waldiez_studio.utils.task_runner.WaldiezRunner.load",
            return_value=mock_runner,
        ),
    ):
        result = run_task(
            "abc123",
            on_input=mock_on_input,
            on_output=lambda *a, **kw: None,
        )

    assert result == "done"
    mock_runner.run.assert_called_once()


def test_run_task_fails_to_load_raises(tmp_path: Path) -> None:
    """Test run_task raises if task loading fails."""
    file_path = tmp_path / "abc123.json"
    file_path.write_text("{}")

    # noinspection PyUnusedLocal
    def mock_on_input(prompt: str, **kwargs: Any) -> str:
        return "ok"

    with (
        patch(
            "waldiez_studio.utils.task_runner.id_to_path",
            return_value=file_path,
        ),
        patch(
            "waldiez_studio.utils.task_runner.WaldiezRunner.load",
            side_effect=OSError("Boom"),
        ),
        patch("waldiez_studio.utils.task_runner.LOG.error") as mock_log,
        pytest.raises(RuntimeError, match="Failed to load task file"),
    ):
        run_task("abc123", on_input=mock_on_input, on_output=print)

    mock_log.assert_called_once()


def test_run_task_fails_to_run_raises(tmp_path: Path) -> None:
    """Test run_task raises if task execution fails."""
    file_path = tmp_path / "abc123.json"
    file_path.write_text("{}")

    mock_runner = MagicMock()
    mock_runner.is_async = False
    mock_runner.run.side_effect = RuntimeError("Execution failed")

    # noinspection PyUnusedLocal
    def mock_on_input(prompt: str, **kwargs: Any) -> str:
        return "yes"

    with (
        patch(
            "waldiez_studio.utils.task_runner.id_to_path",
            return_value=file_path,
        ),
        patch(
            "waldiez_studio.utils.task_runner.WaldiezRunner.load",
            return_value=mock_runner,
        ),
        pytest.raises(RuntimeError, match="Failed to run task"),
    ):
        run_task("abc123", on_input=mock_on_input, on_output=print)
