# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.
# pylint: disable=broad-exception-caught,too-complex,import-error,no-member
# flake8: noqa: C901
# pyright: reportUnknownMemberType=false,reportAttributeAccessIssue=false
# pyright: reportPossiblyUnboundVariable=false,reportUnknownVariableType=false
# pyright: reportUnknownArgumentType=false
"""Unix terminal session implementation."""

import asyncio
import contextlib
import fcntl
import os
import pty
import signal
import struct
import termios
from pathlib import Path

from .base import BaseSession


class UnixSession(BaseSession):
    """Unix session implementation."""

    ALLOWED_SHELLS = {"/bin/bash", "/bin/zsh", "/bin/sh", "/usr/bin/fish"}

    def __init__(self, workdir: Path):
        self.pid: int
        self.master_fd: int
        try:
            self.pid, self.master_fd = pty.fork()
        except OSError as e:
            raise RuntimeError(f"Failed to create PTY: {e}") from e
        if self.pid == 0:  # child  # pragma: no cover
            os.chdir(str(workdir))
            shell = os.environ.get("SHELL", "/bin/bash")
            if shell not in UnixSession.ALLOWED_SHELLS:
                shell = "/bin/bash"
            os.execvp(shell, [shell, "-l"])  # nosemgrep # nosec

        # parent
        flags = fcntl.fcntl(self.master_fd, fcntl.F_GETFL)
        # cspell: disable-next-line
        fcntl.fcntl(self.master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
        self.resize(24, 80)

    def _set_win_size(self, rows: int, cols: int) -> None:
        fcntl.ioctl(
            self.master_fd,
            termios.TIOCSWINSZ,
            struct.pack("HHHH", rows, cols, 0, 0),
        )

    async def read(self, n: int = 4096) -> bytes:
        """Read.

        Parameters
        ----------
        n : int
            The number of rows to read.

        Returns
        -------
        bytes
            The read data.
        """
        # non-blocking read via thread offload
        try:
            return await asyncio.to_thread(os.read, self.master_fd, n)
        except BlockingIOError:
            return b""
        except OSError:
            return b""

    def write(self, data: bytes) -> None:
        """Write.

        Parameters
        ----------
        data : bytes
            The data to pass.
        """
        with contextlib.suppress(OSError):
            os.write(self.master_fd, data)

    def resize(self, rows: int, cols: int) -> None:
        """Resize the terminal.

        Parameters
        ----------
        rows : int
            The new number of rows.
        cols : int
            The new number of columns.
        """
        with contextlib.suppress(Exception):
            self._set_win_size(rows, cols)
            # cspell: disable-next-line
            os.kill(self.pid, signal.SIGWINCH)

    def interrupt(self) -> None:
        """Interrupt the session."""
        with contextlib.suppress(ProcessLookupError, PermissionError):
            # send to child only (group may require privileges)
            os.kill(self.pid, signal.SIGINT)

    def terminate(self) -> None:
        """Terminate the session."""
        with contextlib.suppress(ProcessLookupError):
            os.kill(self.pid, signal.SIGTERM)

    def is_alive(self) -> bool:
        """Check if the session is alive.

        Returns
        -------
        bool
            True if the session is alive, false otherwise.
        """
        with contextlib.suppress(ChildProcessError):
            # cspell: disable-next-line
            res = os.waitpid(self.pid, os.WNOHANG)
            return res == (0, 0)
        return False

    def close(self) -> None:
        """Close the session."""
        with contextlib.suppress(Exception):
            os.close(self.master_fd)
        with contextlib.suppress(ProcessLookupError):
            os.kill(self.pid, signal.SIGHUP)
