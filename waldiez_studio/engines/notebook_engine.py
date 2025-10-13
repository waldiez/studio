# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.
"""Notebook engine implementation."""

# pyright: reportUnknownMemberType=false,reportUnknownArgumentType=false
# pylint: disable=broad-exception-caught,too-many-try-statements

from __future__ import annotations

import asyncio
import contextlib
import json
import time
from pathlib import Path
from typing import Any

from fastapi import WebSocket
from jupyter_client.asynchronous.client import AsyncKernelClient

from .base import Engine
from .kernel import KernelManager


class NotebookEngine(Engine):
    """Notebook engine implementation."""

    file_path: Path
    root_dir: Path
    websocket: WebSocket
    max_queue: int = 1000
    exec_timeout_sec: float = 120.0  # per-code-cell timeout

    kc: AsyncKernelClient | None = None
    _monitor_tasks: list[asyncio.Task[Any]] | None = None
    _queue: asyncio.Queue[dict[str, Any]] | None = None
    _start_ts: float = 0.0

    async def start(self, start_msg: dict[str, Any] | None = None) -> None:
        """Start the run (after receiving the initial 'op=start' message).

        Parameters
        ----------
        start_msg : dict[str, Any]
            Optional start arguments to pass.
        """
        start_msg = start_msg or {}
        fresh = bool(start_msg.get("freshKernel", False))

        if fresh:
            await KernelManager.shutdown_kernel(now=True)

        km = await KernelManager.get()
        self.kc = km.client()
        self.kc.start_channels()
        await self.kc.wait_for_ready(timeout=60)

        self._start_ts = time.time()

        self._queue = asyncio.Queue(maxsize=self.max_queue)
        await self._enqueue(
            {"type": "run_status", "data": {"state": "started"}}
        )

        self._monitor_tasks = [
            asyncio.create_task(self._forward_iopub()),
            asyncio.create_task(self._monitor_stdin()),
            asyncio.create_task(self._send_queued()),
        ]

        # Load notebook
        try:
            nb = json.loads(self.file_path.read_text(encoding="utf-8"))
        except Exception as exc:
            await self._enqueue(
                {
                    "type": "run_stderr",
                    "data": {"text": f"Failed to read notebook: {exc}\n"},
                }
            )
            return

        # Run all code cells, serialized by the global lock
        idx = -1
        async with KernelManager.lock():
            for cell in nb.get("cells", []):
                if cell.get("cell_type") != "code":
                    continue
                idx += 1
                code = "".join(cell.get("source", []))
                await self._enqueue(
                    {"type": "cell_start", "data": {"index": idx}}
                )

                try:
                    self.kc.execute(code)  # fire
                    status = await asyncio.wait_for(
                        self._wait_shell_reply(), timeout=self.exec_timeout_sec
                    )
                except asyncio.TimeoutError:
                    await KernelManager.interrupt()
                    await self._enqueue(
                        {
                            "type": "run_stderr",
                            "data": {
                                "text": "Execution timed out; interrupted.\n"
                            },
                        }
                    )
                    await self._enqueue(
                        {
                            "type": "cell_end",
                            "data": {"index": idx, "status": "timeout"},
                        }
                    )
                    break
                except Exception as exc:
                    await self._enqueue(
                        {
                            "type": "run_stderr",
                            "data": {"text": f"Execution error: {exc}\n"},
                        }
                    )
                    await self._enqueue(
                        {
                            "type": "cell_end",
                            "data": {"index": idx, "status": "error"},
                        }
                    )
                    break
                else:
                    await self._enqueue(
                        {
                            "type": "cell_end",
                            "data": {"index": idx, "status": status},
                        }
                    )

    async def handle_client(self, msg: dict[str, Any]) -> None:
        """Handle subsequent client control messages (stdin/interrupt/etc.).

        Parameters
        ----------
        msg : dict[str, Any]
            Message from the client.
        """
        if not self.kc:
            return
        op = msg.get("op")
        if op == "interrupt":
            await KernelManager.interrupt()
        elif op == "restart":
            await KernelManager.restart()
            with contextlib.suppress(Exception):
                self.kc.stop_channels()
            with contextlib.suppress(Exception):
                self.kc.start_channels()
                await self.kc.wait_for_ready(timeout=60)
        elif op == "input_reply":
            with contextlib.suppress(Exception):
                self.kc.input(msg.get("value", ""))

    async def shutdown(self) -> None:
        """Finalize the run and emit 'run_end' if appropriate."""
        # Cancel monitors
        if self._monitor_tasks:
            for task in self._monitor_tasks:
                task.cancel()
            for task in self._monitor_tasks:
                with contextlib.suppress(asyncio.CancelledError, RuntimeError):
                    await task

        if self.kc:
            with contextlib.suppress(Exception):
                self.kc.stop_channels()

        elapsed = int((time.time() - self._start_ts) * 1000)
        await self._send_safe(
            {"type": "run_end", "data": {"status": "ok", "elapsedMs": elapsed}}
        )

        self._monitor_tasks = None
        self._queue = None

    # pylint: disable=too-complex
    async def _forward_iopub(self) -> None:  # noqa: C901
        if self.kc is None:
            return
        try:
            async for m in self.kc.iopub_channel:
                t = m.get("header", {}).get("msg_type")
                c = m.get("content", {})
                if t == "status":
                    await self._enqueue(
                        {
                            "type": "kernel_status",
                            "data": {
                                "execution_state": c.get("execution_state")
                            },
                        }
                    )
                elif t == "stream":
                    kind = "stdout" if c.get("name") == "stdout" else "stderr"
                    await self._enqueue(
                        {
                            "type": f"run_{kind}",
                            "data": {"text": c.get("text", "")},
                        }
                    )
                elif t in {"display_data", "execute_result"}:
                    data = c.get("data", {})
                    if "image/png" in data:
                        await self._enqueue(
                            {
                                "type": "cell_output",
                                "data": {
                                    "mime": "image/png",
                                    "b64": data["image/png"],
                                },
                            }
                        )
                    if "text/plain" in data:
                        await self._enqueue(
                            {
                                "type": "cell_output",
                                "data": {
                                    "mime": "text/plain",
                                    "text": data["text/plain"],
                                },
                            }
                        )
                    if "text/html" in data:
                        html = data["text/html"]
                        if isinstance(html, list):
                            html = "".join(html)
                        await self._enqueue(
                            {
                                "type": "cell_output",
                                "data": {"mime": "text/html", "text": html},
                            }
                        )
                elif t == "error":
                    tb = "\n".join(c.get("traceback", []))
                    await self._enqueue(
                        {"type": "run_stderr", "data": {"text": tb}}
                    )
        except asyncio.CancelledError as exc:
            raise asyncio.CancelledError("Task was cancelled") from exc
        except Exception:
            pass

    async def _monitor_stdin(self) -> None:
        if self.kc is None:
            return
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(
                        self.kc.stdin_channel.get_msg(), timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue
                except Exception:
                    break
                if msg.get("header", {}).get("msg_type") == "input_request":
                    c = msg.get("content", {})
                    await self._enqueue(
                        {
                            "type": "input_request",
                            "data": {
                                "prompt": c.get("prompt", ""),
                                "password": bool(c.get("password", False)),
                            },
                        }
                    )
        except asyncio.CancelledError as exc:
            raise asyncio.CancelledError("Task was cancelled") from exc
        except Exception:
            pass

    async def _wait_shell_reply(self) -> str:
        if self.kc is None:
            return "error"
        while True:
            msg = await self.kc.shell_channel.get_msg()
            status = msg.get("content", {}).get("status")
            if status in {"ok", "error", "aborted"}:
                return status

    async def _enqueue(self, message: dict[str, Any]) -> None:
        if self._queue is None:
            return
        try:
            self._queue.put_nowait(message)
        except asyncio.QueueFull:
            with contextlib.suppress(asyncio.QueueEmpty):
                _ = self._queue.get_nowait()
            await self._queue.put(message)

    async def _send_queued(self) -> None:
        if self._queue is None:
            return
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                await self._send_safe(msg)
        except asyncio.CancelledError:
            for _ in range(50):
                if self._queue.empty():
                    break
                with contextlib.suppress(Exception):
                    await self._send_safe(self._queue.get_nowait())
            raise

    async def _send_safe(self, message: dict[str, Any]) -> None:
        with contextlib.suppress(Exception):
            await self.websocket.send_json(message)
