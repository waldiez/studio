"""Task runner."""

# pylint: disable=broad-except,unused-argument

import asyncio
import importlib
import logging
import os
import site
import sys
from dataclasses import asdict
from enum import Enum, auto
from typing import TYPE_CHECKING, Dict, List

from fastapi import WebSocket, WebSocketDisconnect
from waldiez import WaldiezRunner

from .paths import id_to_path

if TYPE_CHECKING:
    from autogen import ChatResult  # type: ignore


LOG = logging.getLogger(__name__)
Data = str | bytes
Message = Data | Dict[str, Data] | List[Data]

MAX_ACTIVE_TASKS = 10
MAX_INPUT_QUEUE_SIZE = 10
INPUT_INDICATOR = (
    "Press enter to skip and use auto-reply, "
    "or type 'exit' to end the conversation:"
)

active_tasks_semaphore = asyncio.Semaphore(MAX_ACTIVE_TASKS)


class TaskState(Enum):
    """Task state."""

    NOT_STARTED = auto()
    RUNNING = auto()
    COMPLETED = auto()


class TaskRunner:
    """Task runner."""

    task_state: TaskState

    def __init__(
        self,
        task_id: str,
        websocket: WebSocket,
        input_timeout: float = 120,
    ) -> None:
        """Initialize the task runner.

        Parameters
        ----------
        websocket : WebSocket
            The websocket.
        input_timeout : float, optional
            The input timeout in seconds, by default 120.
        """
        self.websocket = websocket
        self.task_id = task_id
        self.task_state = TaskState.NOT_STARTED
        self.running_task: asyncio.Task[None] | None = None
        self.loop = asyncio.get_running_loop()
        self.stop_event = asyncio.Event()
        self.input_timeout = input_timeout

    async def listen(self) -> None:
        """Listen for WebSocket messages and handle actions.

        Raises
        ------
        asyncio.CancelledError
            If the task is cancelled.
        """
        try:
            while True:
                # pylint: disable=too-many-try-statements
                try:
                    data = await self.websocket.receive_json()
                    LOG.debug("Received data: %s", data)
                    action = data.get("action")
                    if action:
                        await self._handle_action(action)

                except WebSocketDisconnect:
                    LOG.info("WebSocket disconnected.")
                    break
        except asyncio.CancelledError as exc:
            LOG.info("WebSocket listen task cancelled: %s", exc)
            raise exc
        except BaseException as err:
            LOG.error("WebSocket listen connection error: %s", err)
            await self.websocket.close(code=1008, reason="Connection error.")

    async def _handle_action(self, action: str) -> None:
        """Handle actions sent via WebSocket.

        Parameters
        ----------
        action : str
            The action to handle (`status`, `start`, `stop`).
        """
        if action == "start":
            await self._handle_start()
        elif action == "stop":
            await self._handle_stop()
        elif action == "status":
            await self.send_message("status", self.task_state.name)

    async def _handle_start(self) -> None:
        """Handle the start action."""
        if self.task_state in (TaskState.NOT_STARTED, TaskState.COMPLETED):
            self.task_state = TaskState.NOT_STARTED
            await self.run()
        elif self.task_state == TaskState.RUNNING:
            await self.send_message("info", "Task is already running.")

    async def _handle_stop(self) -> None:
        """Handle the stop action."""
        if self.task_state == TaskState.RUNNING:
            await self.stop_task()
        else:
            await self.send_message("info", "No running task to stop.")

    async def stop_task(self) -> None:
        """Stop the running task."""
        if self.running_task and not self.running_task.done():
            self.stop_event.set()
            self.running_task.cancel()
            try:
                await self.running_task
            except asyncio.CancelledError:
                pass
        self.task_state = TaskState.COMPLETED
        await self.send_message("info", "Task stopped.")

    async def send_message(self, msg_type: str, data: Data) -> None:
        """Send a message.

        Parameters
        ----------
        msg_type : str
            The message type.
        data : Data
            The data to send.
        """
        message = {
            "type": msg_type,
            "data": data,
        }
        await self.websocket.send_json(message)

    async def run(self) -> None:
        """Run the task.

        Raises
        ------
        asyncio.CancelledError
            If the task is cancelled or an error occurs.
        """
        async with active_tasks_semaphore:
            if self.task_state == TaskState.RUNNING:
                await self.send_message("info", "Task is already running.")
                return
            if self.task_state == TaskState.COMPLETED:
                await self.send_message("info", "Task is already completed.")
                return

            self.task_state: TaskState = TaskState.RUNNING
            # pylint: disable=too-many-try-statements
            try:
                self.stop_event.clear()
                blocking_task = asyncio.create_task(self._run())
                self.running_task = blocking_task
                await blocking_task
            except (asyncio.CancelledError, BaseException) as exc:
                raise exc
            finally:
                self.stop_event.clear()
                self.running_task = None
                self.task_state = TaskState.COMPLETED

    async def _run(self) -> None:
        """Run the task asynchronously."""
        results = await asyncio.to_thread(
            run_task, self.task_id, self.websocket, self.loop
        )
        if not results:
            raise ValueError("No results returned.")
        await self.websocket.send_json(
            {
                "type": "results",
                "data": [asdict(result) for result in results],
            }
        )


def run_task(
    task_id: str,
    websocket: WebSocket,
    loop: asyncio.AbstractEventLoop,
) -> List["ChatResult"]:
    """Run the blocking function.

    Parameters
    ----------
    task_id : str
        The task ID.
    websocket : WebSocket
        The websocket.
    loop : asyncio.AbstractEventLoop
        The event loop.

    Returns
    -------
    Any
        The result of the blocking function.
    """
    # pylint: disable=import-outside-toplevel,reimported,redefined-outer-name
    modules_to_reload = [
        mod for mod in sys.modules if mod.startswith("autogen")
    ]
    is_testing = os.environ.get("WALDIEZ_STUDIO_TESTING") == "true"
    if not is_testing:
        site.main()
        for mod in modules_to_reload:
            del sys.modules[mod]
        import autogen

        importlib.reload(autogen)

    from autogen.io import IOStream  # type: ignore

    from .io_stream import IOWebsocketsStream  # noqa

    file_path = id_to_path(task_id)
    output_path = file_path.with_suffix(".py")
    io_stream = IOWebsocketsStream(websocket=websocket, loop=loop)
    try:
        runner = WaldiezRunner.load(file_path)
    except BaseException as exc:
        LOG.error("Error: %s", exc)
        io_stream.websocket.send(
            {
                "type": "error",
                "data": {
                    "message": "Error loading task",
                    "details": str(exc),
                },
            }
        )
        return []
    IOStream.set_global_default(io_stream)
    try:
        results = runner.run(output_path=output_path)
        return results if isinstance(results, list) else [results]
    except BaseException as exc:
        LOG.error("Error running task: %s", exc)
        io_stream.websocket.send(
            {
                "type": "error",
                "data": {
                    "message": "Error running task",
                    "details": str(exc),
                },
            }
        )
        return []
