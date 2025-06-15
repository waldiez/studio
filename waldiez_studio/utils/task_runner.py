# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.
# pylint: disable=too-many-try-statements,broad-exception-caught
"""TaskRunner class to manage task execution and WebSocket communication."""

import asyncio
import logging
import os
import uuid
from typing import Any, Callable
from urllib.parse import quote

from autogen import ChatResult  # type: ignore
from autogen.io import IOStream  # type: ignore
from fastapi import WebSocket, WebSocketDisconnect
from waldiez import WaldiezRunner
from waldiez.io import UserResponse

from .delegated_iostream import DelegatedIOStream
from .paths import get_root_dir, id_to_path
from .restart import restart_process
from .results import serialize_results
from .task_state import TaskState

LOG = logging.getLogger(__name__)
Data = str | bytes

MAX_ACTIVE_TASKS = 10
active_tasks_semaphore = asyncio.Semaphore(MAX_ACTIVE_TASKS)


# pylint: disable=too-many-instance-attributes
class TaskRunner:
    """TaskRunner to manage task execution and WebSocket communication."""

    task_state: TaskState

    def __init__(
        self, task_id: str, websocket: WebSocket, input_timeout: float = 30
    ) -> None:
        self.websocket = websocket
        self.task_id = task_id
        self.task_state = TaskState.NOT_STARTED
        self.running_task: asyncio.Task[None] | None = None
        self.comm_handler_task: asyncio.Task[None] | None = None
        self.loop = asyncio.get_running_loop()
        self.stop_event = asyncio.Event()
        self.input_timeout = input_timeout

        self.cwd = os.getcwd()
        self.latest_request_id: str | None = None
        self.pending_inputs: dict[str, asyncio.Future[str]] = {}
        self.output_messages: asyncio.Queue[str] = asyncio.Queue()

    def _handle_user_response(
        self,
        data: dict[str, Any],
    ) -> None:
        """Handle user response data.

        Parameters
        ----------
        data : dict[str, Any]
            The data received from the user response.
        """
        try:
            response = UserResponse.model_validate(data)
            request_id = response.request_id
            self.latest_request_id = request_id
            user_input = response.to_string(
                uploads_root=id_to_path(self.task_id).parent,
                base_name=request_id,
            )
            # LOG.debug("Input response received: %s", user_input)
            future = self.pending_inputs.get(request_id)
            if future and not future.done():  # pragma: no branch
                self.pending_inputs.pop(request_id, None)
                future.set_result(user_input)
        except Exception as exc:
            LOG.error("Validation error for user response: %s", exc)

    async def listen(self) -> None:
        """Listen for WebSocket messages and handle actions.

        Raises
        ------
        asyncio.CancelledError
            If the task is cancelled.
        """
        try:
            while True:
                try:
                    data: dict[str, Any] = await self.websocket.receive_json()
                    # LOG.debug("Received data: %s", data)
                    action = data.get("action")

                    if action:
                        await self._handle_action(action)
                    elif data.get("type") == "input_response":
                        self._handle_user_response(data)
                except WebSocketDisconnect:
                    LOG.info("WebSocket disconnected.")
                    break
        except asyncio.CancelledError as exc:
            LOG.info("WebSocket listen task cancelled: %s", exc)
            raise
        except BaseException as err:
            LOG.error("WebSocket error: %s", err)
            await self.websocket.close(code=1008, reason="Connection error.")

    async def stop_task(self) -> None:
        """Stop the currently running task and clean up resources."""
        self.stop_event.set()

        if (
            self.running_task and not self.running_task.done()
        ):  # pragma: no branch
            self.running_task.cancel()
            try:
                await asyncio.wait_for(self.running_task, timeout=5)
            except asyncio.TimeoutError:
                LOG.warning("Forcefully stopping running task due to timeout.")
            except asyncio.CancelledError:
                pass

        if (
            self.comm_handler_task and not self.comm_handler_task.done()
        ):  # pragma: no branch
            self.comm_handler_task.cancel()
            try:
                await asyncio.wait_for(self.comm_handler_task, timeout=2)
            except asyncio.TimeoutError:
                LOG.warning(
                    "Forcefully stopping comm handler task due to timeout."
                )
            except asyncio.CancelledError:
                pass

        self.task_state = TaskState.COMPLETED
        await self.send_message("info", "Task stopped.")
        # Restart the process to ensure a clean state
        self._restart_process()

    def _restart_process(self) -> None:  # pragma: no cover
        """Restart the current process to ensure a clean state."""
        is_testing = (
            os.environ.get("WALDIEZ_STUDIO_TESTING", "False").lower() == "true"
        )
        if is_testing:
            return
        os.chdir(self.cwd)
        restart_process()

    async def run(self) -> None:
        """Run the task in a separate thread and handle communication.

        Raises
        ------
        asyncio.CancelledError
            If the task is cancelled.
        BaseException
            If there is an error during task execution.
        """
        async with active_tasks_semaphore:
            if self.task_state == TaskState.RUNNING:
                await self.send_message("info", "Task is already running.")
                return
            if self.task_state == TaskState.COMPLETED:
                await self.send_message("info", "Task is already completed.")
                return

            self.task_state = TaskState.RUNNING
            self.stop_event.clear()

            # Start comm handler to forward outputs
            self.comm_handler_task = asyncio.create_task(
                self._handle_thread_communication()
            )

            try:
                self.running_task = asyncio.create_task(self._run())
                await self.running_task
            except (asyncio.CancelledError, BaseException) as exc:
                LOG.error("Task run error: %s", exc)
                raise
            finally:
                self.stop_event.set()
                if self.comm_handler_task and not self.comm_handler_task.done():
                    self.comm_handler_task.cancel()
                    try:
                        await self.comm_handler_task
                    except asyncio.CancelledError:
                        pass
                self.running_task = None
                # pylint: disable=redefined-variable-type
                self.task_state = TaskState.COMPLETED

    async def _handle_action(self, action: str) -> None:
        """Handle actions received from the WebSocket.

        Parameters
        ----------
        action : str
            The action to handle (e.g., "start", "stop", "status").
        """
        if action == "start":
            await self._handle_start()
        elif action == "stop":
            await self._handle_stop()
        elif action == "status":
            await self.send_message("status", self.task_state.name)

    async def _handle_start(self) -> None:
        """Handle the start action for the task."""
        if self.task_state in (TaskState.NOT_STARTED, TaskState.COMPLETED):
            self.task_state = TaskState.NOT_STARTED
            asyncio.create_task(self.run())
        elif self.task_state == TaskState.RUNNING:  # pragma: no branch
            await self.send_message("info", "Task is already running.")

    async def _handle_stop(self) -> None:
        """Handle the stop action for the task."""
        if self.task_state == TaskState.RUNNING:
            await self.stop_task()
        else:
            await self.send_message("info", "No running task to stop.")

    async def _run(self) -> None:
        on_input, on_output = self._create_thread_safe_callbacks()

        results = await asyncio.to_thread(
            run_task,
            self.task_id,
            on_input,
            on_output,
        )

        if not results:  # pragma: no cover
            raise ValueError("No results returned.")

        await self.websocket.send_json(
            {
                "type": "results",
                "data": serialize_results(results),
            }
        )

    async def _handle_thread_communication(self) -> None:
        try:
            while not self.stop_event.is_set():
                try:
                    # Use asyncio.wait_for to avoid infinite blocking
                    msg = await asyncio.wait_for(
                        self.output_messages.get(), timeout=0.1
                    )
                    await self._send_output(msg)
                except asyncio.TimeoutError:
                    continue
        except asyncio.CancelledError:  # pragma: no cover
            LOG.warning("Thread communication handler cancelled.")

    def _create_thread_safe_callbacks(
        self,
    ) -> tuple[Callable[[str], str], Callable[..., None]]:
        # pylint: disable=unused-argument
        def on_input(prompt: str, *, password: bool = False) -> str:
            """Thread-safe input callback.

            Parameters
            ----------
            prompt : str
                The input prompt to display.
            password : bool, optional
                Whether the input is a password (default is False).

            Returns
            -------
            str
                The input received from the user.
            """
            coro = self._send_input_request(prompt)
            future = asyncio.run_coroutine_threadsafe(coro, self.loop)
            return future.result(timeout=self.input_timeout)

        def on_output(
            *objects: Any, sep: str = " ", end: str = "\n", flush: bool = False
        ) -> None:
            """Thread-safe output callback.

            Parameters
            ----------
            objects : Any
                The objects to output.
            sep : str, optional
                The separator between objects (default is a space).
            end : str, optional
                The string appended after the last object.
                Defaults to a new line (\\n).
            flush : bool, optional
                Whether to flush the output (default is False).
            """
            message = sep.join(str(obj) for obj in objects) + end
            self.output_messages.put_nowait(message)

        return on_input, on_output

    async def _send_input_request(self, prompt: str) -> str:
        request_id = uuid.uuid4().hex
        self.latest_request_id = request_id
        future = self.loop.create_future()
        self.pending_inputs[request_id] = future

        await self.websocket.send_json(
            {
                "id": request_id,
                "type": "input_request",
                "request_id": request_id,
                "prompt": prompt,
                "password": False,
                "content": [{"type": "text", "text": prompt}],
            }
        )

        try:
            return await asyncio.wait_for(future, timeout=self.input_timeout)
        except asyncio.TimeoutError:
            LOG.warning(
                "Input request timed out after %.1f seconds.",
                self.input_timeout,
            )
            return ""
        finally:
            self.pending_inputs.pop(request_id, None)

    def _replace_image_placeholders(self, message: str) -> str:
        """Replace image placeholders in the message with actual image links.

        Parameters
        ----------
        message : str
            The message containing image placeholders.

        Returns
        -------
        str
            The message with image placeholders replaced by actual links.
        """
        if (
            "<image>" not in message or not self.latest_request_id
        ):  # pragma: no cover
            return message
        uploads_root = id_to_path(self.task_id).parent
        public_image_path = str(uploads_root.relative_to(get_root_dir()))
        if public_image_path.startswith("."):  # pragma: no branch
            public_image_path = public_image_path[1:]
        if (
            not public_image_path or public_image_path == "."
        ):  # pragma: no branch
            public_image_path = ""
        else:  # pragma: no cover
            public_image_path += "/"

        public_image_path = quote(public_image_path, safe="/")
        image_path = (
            f"/api/workspace/download?path={public_image_path}"
            f"{self.latest_request_id}.png"
        )
        return message.replace("<image>", str(image_path))

    async def _send_output(self, message: str) -> None:
        processed_message = self._replace_image_placeholders(message)
        await self.websocket.send_json(
            {
                "type": "print",
                "data": processed_message,
            }
        )

    async def send_message(self, msg_type: str, data: Data) -> None:
        """Send a message through the WebSocket.

        Parameters
        ----------
        msg_type : str
            The type of the message (e.g., "status", "info", "error").
        data : Data
            The data to send, which can be a string or bytes.
        """
        await self.websocket.send_json(
            {
                "type": msg_type,
                "data": data,
            }
        )


def run_task(
    task_id: str,
    on_input: Callable[..., str],
    on_output: Callable[..., None],
) -> ChatResult | list[ChatResult] | dict[int, ChatResult]:
    """Run a Waldiez task with the given task ID.

    Parameters
    ----------
    task_id : str
        The ID of the task to run.
    on_input : Callable[..., str]
        Callback function to handle input requests.
    on_output : Callable[..., None]
        Callback function to handle output messages.

    Returns
    -------
    ChatResult | list[ChatResult] | dict[int, ChatResult]
        The results of the task execution.

    Raises
    ------
    Exception
        If there is an error loading the task file or running the task.
    """
    file_path = id_to_path(task_id)
    output_path = file_path.with_suffix(".py")

    try:
        runner = WaldiezRunner.load(file_path)
    except Exception as exc:
        LOG.error("Error loading task file: %s", exc)
        raise RuntimeError(
            f"Failed to load task file {file_path}: {exc}"
        ) from exc

    try:
        stream = DelegatedIOStream(
            on_input=on_input,
            on_output=on_output,
            is_async=runner.is_async,
        )
        with IOStream.set_default(stream):
            return runner.run(
                output_path=output_path, uploads_root=file_path.parent
            )
    except Exception as exc:
        raise RuntimeError(f"Failed to run task {task_id}: {exc}") from exc
