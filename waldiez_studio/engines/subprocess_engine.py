# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.
"""Subprocess engine implementation."""

from __future__ import annotations

import asyncio
import contextlib
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

from fastapi import WebSocket

from .base import Engine

_READ_CHUNK = 16_384  # 16 KB per read
_MAX_PENDING_LINE_BYTES = 2_000_000


class SubprocessEngine(Engine):
    """Subprocess engine implementation."""

    file_path: Path
    root_dir: Path
    websocket: WebSocket

    proc: asyncio.subprocess.Process | None = None
    _monitor_tasks: list[asyncio.Task[Any]] | None = None
    _queue: asyncio.Queue[dict[str, Any]] | None = None
    _start_ts: float = 0.0
    _wait_task: asyncio.Task[Any] | None = None
    _did_end: bool = False

    async def start(self, start_msg: dict[str, Any] | None = None) -> None:
        """Start the run (after receiving the initial 'op=start' message).

        Parameters
        ----------
        start_msg : dict[str, Any]
            Optional start arguments to pass.
        """
        start_msg = start_msg or {}
        module = start_msg.get("module", "")
        args = list(start_msg.get("args", []))
        env = os.environ.copy()
        env.update(start_msg.get("env", {}))
        env.setdefault("PYTHONUNBUFFERED", "1")
        env.setdefault("PYTHONIOENCODING", "utf-8")
        module_args: list[str] = (
            ["-m", module] if module else [str(self.file_path)]
        )
        py = sys.executable
        venv = start_msg.get("venv")
        if venv:
            if sys.platform == "win32":  # pragma: no cover
                cmd = Path(venv) / "Scripts" / "python.exe"
            else:
                cmd = Path(venv) / "bin" / "python"
            if cmd.exists():
                py = str(cmd)

        cwd = (
            self.root_dir
            if not start_msg.get("cwd")
            else (self.root_dir / str(start_msg["cwd"]))
        )
        self._start_ts = time.time()
        creationflags = 0
        if sys.platform == "win32":
            creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        self.proc = await asyncio.create_subprocess_exec(
            py,
            *module_args,
            *args,
            cwd=str(cwd),
            env=env,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            start_new_session=sys.platform != "win32",
            creationflags=creationflags,
        )

        self._queue = asyncio.Queue(maxsize=10000)
        await self._queue.put(
            {
                "type": "run_status",
                "data": {
                    "state": "started",
                    "pid": self.proc.pid,
                    "cwd": str(cwd),
                },
            }
        )

        self._monitor_tasks = [
            asyncio.create_task(self._read_stream(self.proc.stdout, "stdout")),
            asyncio.create_task(self._read_stream(self.proc.stderr, "stderr")),
            asyncio.create_task(self._send_queued()),
        ]
        self._wait_task = asyncio.create_task(self._wait_and_finalize())

    def _interrupt(self) -> None:
        if not self.proc:
            return
        # pylint: disable=no-member
        try:
            if sys.platform == "win32":
                # Requires CREATE_NEW_PROCESS_GROUP at spawn time
                self.proc.send_signal(signal.CTRL_BREAK_EVENT)  # type: ignore
            else:
                try:
                    pgid = os.getpgid(self.proc.pid)
                    # cspell: disable-next-line
                    os.killpg(pgid, signal.SIGINT)
                except PermissionError:
                    self.proc.send_signal(signal.SIGINT)
        except ProcessLookupError:
            pass

    def _terminate(self) -> None:
        if not self.proc:
            return
        # pylint: disable=no-member,too-many-try-statements
        try:
            if sys.platform == "win32":
                self.proc.terminate()
                return
            getpgid = getattr(os, "getpgid", None)
            killpg = getattr(os, "killpg", None)

            if getpgid and killpg:
                try:
                    # pylint: disable=not-callable
                    pgid = getpgid(self.proc.pid)
                    killpg(pgid, signal.SIGTERM)
                    return
                except PermissionError:
                    # Fall back to terminating just the child
                    self.proc.terminate()
                    return
            # If no pgid/killpg, fall back
            self.proc.terminate()
        except ProcessLookupError:
            pass

    def _kill(self) -> None:
        if not self.proc:
            return
        # pylint: disable=no-member,too-many-try-statements
        try:
            if sys.platform == "win32":
                self.proc.kill()
                return
            getpgid = getattr(os, "getpgid", None)
            killpg = getattr(os, "killpg", None)
            sigkill = getattr(signal, "SIGKILL", signal.SIGTERM)

            if getpgid and killpg:
                try:
                    # pylint: disable=not-callable
                    pgid = getpgid(self.proc.pid)
                    killpg(pgid, sigkill)
                    return
                except PermissionError:
                    self.proc.kill()
        except ProcessLookupError:
            pass

    async def _handle_stdin(self, msg: dict[str, Any]) -> None:
        """Handle stdin request."""
        self.log.debug("Got message: %s", msg)
        if not self.proc:
            return
        # pylint: disable=too-many-try-statements,broad-exception-caught
        try:
            text = msg.get("text", "") or ""
            if not text.endswith("\n"):
                text += "\n"
            data = text.encode(errors="replace")
            if self.proc.stdin and not self.proc.stdin.is_closing():
                self.proc.stdin.write(data)
                await self.proc.stdin.drain()
                if self._queue:
                    await self._queue.put(
                        {
                            "type": "run_stdin_ack",
                            "data": {
                                "text": text,
                                "request_id": msg.get("request_id"),
                            },
                        }
                    )
            else:
                if self._queue:
                    await self._queue.put(
                        {
                            "type": "run_stdin_error",
                            "data": {
                                "message": msg,
                                "error": "No active process",
                            },
                        }
                    )
        except Exception as e:
            if self._queue:
                await self._queue.put(
                    {
                        "type": "run_stdin_error",
                        "data": {"message": msg, "error": str(e)},
                    }
                )

    # pylint: disable=too-complex
    async def handle_client(self, msg: dict[str, Any]) -> None:  # noqa: C901
        """Handle subsequent client control messages (stdin/interrupt/etc.).

        Parameters
        ----------
        msg : dict[str, Any]
            Message from the client.
        """
        self.log.debug("Handling client message: %s", msg)
        if not self.proc:
            return
        op = msg.get("op")

        if op == "stdin":
            await self._handle_stdin(msg)

        elif op == "stdin_eof":
            if self.proc.stdin and not self.proc.stdin.is_closing():
                with contextlib.suppress(Exception, NotImplementedError):
                    self.proc.stdin.write_eof()

        elif op == "interrupt":
            self._interrupt()

        elif op in ("terminate", "shutdown"):
            self._terminate()

        elif op == "kill":
            self._kill()

    async def shutdown(self) -> None:
        """Finalize the run and emit 'run_end' once via _finalize()."""
        # try to let the proc end quickly; if not, escalate a bit
        if self.proc and self.proc.returncode is None:
            try:
                await asyncio.wait_for(self.proc.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                # gentle stop
                self._terminate()
                try:
                    await asyncio.wait_for(self.proc.wait(), timeout=3.0)
                except asyncio.TimeoutError:
                    # hard stop
                    self._kill()
                    with contextlib.suppress(Exception):
                        await self.proc.wait()

        # cancel the waiter so it doesn't race; then finalize exactly once
        if self._wait_task:
            self._wait_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._wait_task
            self._wait_task = None

        # compute rc and finalize (will cancel readers/sender and send run_end)
        rc = self.proc.returncode if self.proc else 0
        await self._finalize(rc)

    async def _wait_and_finalize(self) -> None:
        if not self.proc:
            return
        try:
            rc = await self.proc.wait()
        except asyncio.CancelledError:
            return
        await self._finalize(rc)

    async def _finalize(self, rc: int | None) -> None:
        if self._did_end:
            return
        self._did_end = True

        # stop readers/sender
        if self._monitor_tasks:
            for t in self._monitor_tasks:
                t.cancel()
            for t in self._monitor_tasks:
                with contextlib.suppress(asyncio.CancelledError, RuntimeError):
                    await t
            self._monitor_tasks = None

        elapsed = int((time.time() - self._start_ts) * 1000)
        await self._send_safe(
            {
                "type": "run_end",
                "data": {
                    "status": "ok" if (rc or 0) == 0 else "error",
                    "returnCode": rc or 0,
                    "elapsedMs": elapsed,
                },
            }
        )

    # pylint: disable=too-many-try-statements,too-complex
    async def _read_stream(  # noqa: C901
        self, stream: asyncio.StreamReader | None, label: str
    ) -> None:
        if not self.proc or not stream:
            self.log.warning(
                "No process or stream. no process: %s, no stream: %s",
                not self.proc,
                not stream,
            )
            return
        buf = bytearray()

        async def emit(line_bytes: bytes) -> None:
            # Decode defensively; your downstream can JSON-parse if it wants.
            text = line_bytes.decode("utf-8", errors="replace")
            if self._queue:
                await self._queue.put(
                    {
                        "type": f"run_{label}",  # "stdout" or "stderr"
                        "data": {"text": text},
                    }
                )

        try:
            while True:
                chunk = await stream.read(_READ_CHUNK)
                if not chunk:  # EOF
                    break
                self.log.debug("CHUNK: %s", chunk)
                buf.extend(chunk)

                # Emit every complete line we have
                start = 0
                while True:
                    nl = buf.find(b"\n", start)
                    if nl == -1:
                        # If we’ve buffered a massive no-newline line,
                        # spill a piece
                        if len(buf) > _MAX_PENDING_LINE_BYTES:
                            spill, buf = (
                                bytes(buf[:_READ_CHUNK]),
                                buf[_READ_CHUNK:],
                            )
                            await emit(spill)
                        break
                    line, start = bytes(buf[:nl]), nl + 1
                    await emit(line)
                # Keep only the remainder (after last newline)
                if start:
                    del buf[:start]

            # Flush any tail without a trailing newline
            if buf:
                await emit(bytes(buf))
        except asyncio.CancelledError as e:
            raise asyncio.CancelledError(str(e)) from e
        except Exception as e:  # pylint: disable=broad-exception-caught
            # Surface stream errors in the queue so callers can react
            if self._queue:
                await self._queue.put(
                    {
                        "type": f"{label}_error",
                        "data": f"{type(e).__name__}: {e}",
                    }
                )

    async def _send_queued(self) -> None:
        if not self._queue:
            return
        try:
            while True:
                try:
                    message = await asyncio.wait_for(
                        self._queue.get(), timeout=1.0
                    )
                except asyncio.TimeoutError:
                    # periodically check for process end to exit faster
                    # if queue empty
                    if (
                        self.proc
                        and self.proc.returncode is not None
                        and self._queue.empty()
                    ):
                        break
                    continue
                await self._send_safe(message)
        except asyncio.CancelledError:
            # flush a few messages quickly on cancellation
            for _ in range(50):
                if self._queue.empty():
                    break
                with contextlib.suppress(Exception):
                    await self._send_safe(self._queue.get_nowait())
            raise

    async def _send_safe(self, message: Any) -> None:
        with contextlib.suppress(Exception):
            if isinstance(message, (dict, list, tuple, set)):
                await self.websocket.send_json(message)
            else:
                await self.websocket.send_text(str(message))
