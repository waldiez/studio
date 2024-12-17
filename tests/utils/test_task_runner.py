"""Test the task runner."""

# pylint: disable=missing-function-docstring,missing-return-doc,missing-param-doc,missing-yield-doc,protected-access,unused-argument,line-too-long

import asyncio
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, List
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.websockets import WebSocket, WebSocketDisconnect
from waldiez.runner import WaldiezRunner

from waldiez_studio.utils.paths import path_to_id
from waldiez_studio.utils.task_runner import TaskRunner, TaskState, run_task


@pytest.fixture(name="websocket")
async def websocket_fixture() -> AsyncMock:
    """Fixture for mocking WebSocket."""
    ws = AsyncMock(spec=WebSocket)
    return ws


@pytest.fixture(name="task_runner")
async def task_runner_fixture(websocket: WebSocket) -> TaskRunner:
    """Fixture for creating TaskRunner instance."""
    return TaskRunner(task_id="test_task", websocket=websocket)


@pytest.mark.asyncio
async def test_initial_task_state(task_runner: TaskRunner) -> None:
    """Test initial state of TaskRunner."""
    assert task_runner.task_state == TaskState.NOT_STARTED
    assert task_runner.running_task is None


@pytest.mark.asyncio
async def test_listen_handle_start(
    task_runner: TaskRunner, websocket: AsyncMock
) -> None:
    """Test handling of 'start' action in listen()."""
    # Simulate receiving the "start" action and a WebSocket disconnect
    websocket.receive_json.side_effect = [
        {"action": "start"},
        WebSocketDisconnect,
    ]

    # Mock the _run method to prevent real execution
    with patch.object(task_runner, "_run", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = None  # Simulate successful task execution

        # Run the listen method
        await task_runner.listen()

        # Verify that _run was triggered
        mock_run.assert_awaited_once()

    # Confirm task state transitioned to COMPLETED
    assert (
        task_runner.task_state == TaskState.COMPLETED
    ), "Task state did not transition to COMPLETED"


@pytest.mark.asyncio
async def test_listen_handle_stop(
    task_runner: TaskRunner, websocket: AsyncMock
) -> None:
    """Test handling of 'stop' action."""
    task_runner.task_state = TaskState.RUNNING
    websocket.receive_json.side_effect = [
        {"action": "stop"},
        WebSocketDisconnect,
    ]

    with patch.object(
        task_runner, "stop_task", wraps=task_runner.stop_task
    ) as stop_mock:
        await task_runner.listen()

    stop_mock.assert_called_once()
    websocket.send_json.assert_any_call(
        {"type": "info", "data": "Task stopped."}
    )


@pytest.mark.asyncio
async def test_listen_handle_status(
    task_runner: TaskRunner, websocket: AsyncMock
) -> None:
    """Test handling of 'status' action."""
    websocket.receive_json.side_effect = [
        {"action": "status"},
        WebSocketDisconnect,
    ]

    await task_runner.listen()

    websocket.send_json.assert_any_call(
        {"type": "status", "data": "NOT_STARTED"}
    )


@pytest.mark.asyncio
async def test_handle_start_already_running(
    task_runner: TaskRunner, websocket: AsyncMock
) -> None:
    """Test start action when task is already running."""
    task_runner.task_state = TaskState.RUNNING

    await task_runner._handle_start()
    websocket.send_json.assert_called_once_with(
        {"type": "info", "data": "Task is already running."}
    )


@pytest.mark.asyncio
async def test_handle_stop_no_running_task(
    task_runner: TaskRunner, websocket: AsyncMock
) -> None:
    """Test stop action when no task is running."""
    task_runner.task_state = TaskState.NOT_STARTED

    await task_runner._handle_stop()
    websocket.send_json.assert_called_once_with(
        {"type": "info", "data": "No running task to stop."}
    )


@pytest.mark.asyncio
async def test_run_task_completion(
    task_runner: TaskRunner, websocket: AsyncMock
) -> None:
    """Test successful task run."""

    @dataclass
    class MockResult:
        """Mock result."""

        result: str

    async def mock_to_thread(*args: Any, **kwargs: Any) -> List[MockResult]:
        return [MockResult(result="success")]

    with patch("asyncio.to_thread", side_effect=mock_to_thread):
        await task_runner.run()

    websocket.send_json.assert_any_call(
        {"type": "results", "data": [{"result": "success"}]}
    )
    assert task_runner.task_state == TaskState.COMPLETED


@pytest.mark.asyncio
async def test_run_task_cancellation(
    task_runner: TaskRunner, websocket: AsyncMock
) -> None:
    """Test task cancellation."""

    async def mock_task() -> None:
        try:
            await asyncio.sleep(1)  # Simulate a long-running task
        except asyncio.CancelledError:
            # Clean up when the task is cancelled
            pass

    with patch.object(task_runner, "_run", side_effect=mock_task):
        task = asyncio.create_task(task_runner.run())
        await asyncio.sleep(0.1)  # Let the task start
        await task_runner.stop_task()
        try:
            await task
        except asyncio.CancelledError:
            pass

    assert task_runner.task_state == TaskState.COMPLETED
    websocket.send_json.assert_any_call(
        {"type": "info", "data": "Task stopped."}
    )


@pytest.mark.asyncio
async def test_run_task(tmp_path: Path) -> None:
    """Test run_task function."""
    src = Path(__file__).parent.parent / "data" / "simple.waldiez"
    dst = tmp_path / "simple.waldiez"
    shutil.copyfile(src, dst)
    task_id = path_to_id(dst)
    websocket = AsyncMock(spec=WebSocket)
    loop = asyncio.get_event_loop()
    results = await asyncio.to_thread(run_task, task_id, websocket, loop)
    assert len(results[0].chat_history) > 1


def test_run_task_no_results() -> None:
    """Test run_task function with no results."""
    task_id = "invalid_task_id"
    websocket = AsyncMock(spec=WebSocket)
    loop = asyncio.get_event_loop()
    with pytest.raises(ValueError):
        run_task(task_id, websocket, loop)


@pytest.mark.asyncio
async def test_run_task_exception(tmp_path: Path) -> None:
    """Test run_task function with exception."""
    src = Path(__file__).parent.parent / "data" / "simple.waldiez"
    dst = tmp_path / "simple.waldiez"
    shutil.copyfile(src, dst)
    task_id = path_to_id(dst)
    websocket = AsyncMock(spec=WebSocket)
    loop = asyncio.get_event_loop()

    with patch.object(
        WaldiezRunner, "run", side_effect=BaseException("Task error")
    ):
        results = await asyncio.to_thread(run_task, task_id, websocket, loop)
        assert not results
        websocket.send_json.assert_called_once_with(
            {
                "type": "print",
                "data": '{"type": "error", "data": {"message": "Error running task", "details": "Task error"}}',
            }
        )
