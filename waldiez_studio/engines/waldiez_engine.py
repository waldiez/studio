# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.
"""Waldiez engine implementation."""

from __future__ import annotations

import asyncio
import contextlib
import json
from pathlib import Path
from typing import Any

from waldiez import WaldiezExporter

from .base import Engine
from .subprocess_engine import SubprocessEngine


class WaldiezEngine(Engine):
    """Waldiez engine implementation."""

    _task: asyncio.Task[Any] | None = None
    _delegate: SubprocessEngine | None = None

    async def start(self, start_msg: dict[str, Any] | None = None) -> None:
        """Start the run (after receiving the initial 'op=start' message).

        Parameters
        ----------
        start_msg : dict[str, Any]
            Optional start arguments to pass.
        """
        start_msg = start_msg or {}
        await self._send_safe(
            {
                "type": "compile_start",
                "data": {
                    "source": str(self.file_path.relative_to(self.root_dir))
                },
            }
        )
        try:
            py_path = await self._compile_to_py(self.file_path)
        except Exception as exc:  # pylint: disable=broad-exception-caught
            await self._send_safe(
                {"type": "compile_error", "data": {"message": f"{exc}"}}
            )
            # Surface an early end for the UI; no delegate run
            await self._send_safe(
                {
                    "type": "run_end",
                    "data": {
                        "status": "error",
                        "returnCode": -1,
                        "elapsedMs": 0,
                    },
                }
            )
            return

        await self._send_safe(
            {
                "type": "compile_end",
                "data": {"py": str(py_path.relative_to(self.root_dir))},
            }
        )

        # Delegate to the subprocess engine
        self._delegate = SubprocessEngine(
            file_path=py_path, root_dir=self.root_dir, websocket=self.websocket
        )
        args: dict[str, Any] = {
            "module": "waldiez",  # python -m waldiez
            "args": [
                "run",
                "--file",
                self.file_path,
                "--output",
                py_path,
                "--force",
                "--structured",
            ],
        }
        cmd_args = start_msg.get("args", [])
        if cmd_args and isinstance(cmd_args, list) and "--step" in cmd_args:
            args["args"].append("--step")
        await self._delegate.start(args)

    async def handle_client(self, msg: dict[str, Any]) -> None:
        """Handle subsequent client control messages (stdin/interrupt/etc.).

        Parameters
        ----------
        msg : dict[str, Any]
            Message from the client.
        """
        if self._delegate:
            the_msg = msg
            if the_msg.get("op") in (
                "waldiez_respond",
                "waldiez_control",
            ) and the_msg.get("payload", {}):
                await self._delegate.handle_client(
                    {"op": "stdin", "text": json.dumps(the_msg.get("payload"))}
                )
            else:
                await self._delegate.handle_client(msg)

    async def shutdown(self) -> None:
        """Finalize the run and emit 'run_end' if appropriate."""
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError, RuntimeError):
                await self._task
        self._task = None
        if self._delegate:
            await self._delegate.shutdown()

    @staticmethod
    async def _compile_to_py(src: Path) -> Path:
        exporter = WaldiezExporter.load(src)
        output = src.with_suffix(".py")
        exporter.export(output, force=True)
        return output

    async def _send_safe(self, message: dict[str, Any]) -> None:
        try:
            await self.websocket.send_json(message)
        except Exception:  # pylint: disable=broad-exception-caught
            # ignore socket issues; upstream will close
            pass
