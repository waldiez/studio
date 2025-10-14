# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# pylint: disable=broad-exception-caught,import-error
# pyright: reportUnknownMemberType=false,reportAttributeAccessIssue=false
# pyright: reportPossiblyUnboundVariable=false,reportUnknownVariableType=false
# pyright: reportUnknownArgumentType=false,reportUnnecessaryIsInstance=false
# pyright: reportUnknownParameterType=false,reportMissingImports=false
# pyright: reportMissingTypeStubs=false

"""Windows terminal session implementation."""

import asyncio
import contextlib
from pathlib import Path
from shutil import which

from .base import BaseSession

try:
    import winpty  # type: ignore

    _HAVE_PYWINPTY = True
except (ImportError, ModuleNotFoundError):
    _HAVE_PYWINPTY = False  # pyright:ignore[reportConstantRedefinition]


def _preferred_windows_shell_argv() -> list[str]:
    """Prefer pwsh, then Windows PowerShell, then cmd."""
    candidates: tuple[tuple[str, list[str]], ...] = (
        ("pwsh.exe", ["-NoLogo", "-NoProfile"]),
        ("pwsh", ["-NoLogo", "-NoProfile"]),
        ("powershell.exe", ["-NoLogo", "-NoProfile"]),
        ("powershell", ["-NoLogo", "-NoProfile"]),
        ("cmd.exe", []),
        ("cmd", []),
    )
    for name, args in candidates:
        exe = which(name)
        if exe:
            return [exe, *args]
    # if which() finds nothing; let CreateProcess resolve it
    return ["powershell.exe", "-NoLogo", "-NoProfile"]


def _spawn_winpty(argv: list[str], cwd: str) -> winpty.PtyProcess:
    """
    Spawn using argv list if supported; otherwise join into a string.
    Avoid quoting the exe path.
    """
    try:
        return winpty.PtyProcess.spawn(argv, cwd=cwd)
    except TypeError:
        cmd = " ".join(argv)
        return winpty.PtyProcess.spawn(cmd, cwd=cwd)


class WindowsSession(BaseSession):
    """Windows session implementation."""

    def __init__(self, workdir: Path):
        if not _HAVE_PYWINPTY:
            msg = (
                "pywinpty is required for terminal on Windows. "
                "Install with: pip install pywinpty"
            )
            raise RuntimeError(msg)

        cwd = str(workdir)
        argv = _preferred_windows_shell_argv()

        # Optional: early sanity check & clearer error
        exe = Path(argv[0])
        if (exe.drive or exe.anchor) and not exe.is_file():
            # Don't include extra quotes here — keep the raw path
            raise FileNotFoundError(
                f"The shell executable was not found: {exe}"
            )

        self.pty = _spawn_winpty(argv, cwd=cwd)

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
        try:
            data = await asyncio.to_thread(self.pty.read, n)
            return (
                data.encode("utf-8", "ignore")
                if isinstance(data, str)
                else data
            )
        except Exception:
            return b""

    def write(self, data: bytes) -> None:
        """Write.

        Parameters
        ----------
        data : bytes
            The data to pass.
        """
        try:
            self.pty.write(data.decode("utf-8", "ignore"))
        except Exception:
            pass

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
            # cspell: disable-next-line
            self.pty.setwinsize(rows=rows, cols=cols)

    def interrupt(self) -> None:
        """Interrupt the session."""
        # Send Ctrl-C (0x03)
        with contextlib.suppress(Exception):
            self.pty.write("\x03")

    def terminate(self) -> None:
        """Terminate the session."""
        with contextlib.suppress(Exception):
            self.pty.terminate()

    def is_alive(self) -> bool:
        """Check if the session is alive.

        Returns
        -------
        bool
            True if the session is alive, false otherwise.
        """
        try:
            # cspell: disable-next-line
            return self.pty.isalive()
        except Exception:
            return False

    def close(self) -> None:
        """Close the session."""
        with contextlib.suppress(Exception):
            self.pty.close()
