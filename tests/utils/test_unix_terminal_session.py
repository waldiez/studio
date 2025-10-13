# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.
"""Test waldiez_studio.utils.terminal_session.*. on unix"""
# mypy: disable-error-code="attr-defined"
# pylint: disable=missing-function-docstring,missing-return-doc,
# pylint: disable=missing-yield-doc,missing-param-doc,no-member
# pylint: disable=missing-raises-doc,line-too-long,import-outside-toplevel
# pyright: reportUnknownLambdaType=false,reportUnknownArgumentType=false
# pyright: reportUnknownVariableType=false,reportUnknownMemberType=false
# pyright: reportAttributeAccessIssue=false,reportPrivateLocalImportUsage=false

import signal
import sys
import types
from pathlib import Path
from typing import Any

import pytest

unix_only = pytest.mark.skipif(sys.platform == "win32", reason="UNIX-only test")


@unix_only
def test_unix_session_init_sets_non_blocking_and_initial_resize(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from waldiez_studio.utils.terminal_session import unix_session as mod

    # Arrange: fake pty.fork -> (pid, master_fd)
    fake_pid = 1234
    fake_fd = 42

    monkeypatch.setattr(
        mod, "pty", types.SimpleNamespace(fork=lambda: (fake_pid, fake_fd))
    )

    fcntl_calls: list[tuple[Any, Any, Any]] = []

    def _fake_fcntl(fd: Any, op: Any, *args: Any) -> int:
        fcntl_calls.append((fd, op, args))
        if op == mod.fcntl.F_GETFL:
            return 0
        return 0

    monkeypatch.setattr(
        mod,
        "fcntl",
        types.SimpleNamespace(fcntl=_fake_fcntl, F_GETFL=1, F_SETFL=2),
    )

    ioctl_calls: list[tuple[Any, Any, Any]] = []

    def _fake_ioctl(fd: Any, req: Any, data: Any) -> None:
        ioctl_calls.append((fd, req, data))

    monkeypatch.setattr(mod, "termios", types.SimpleNamespace(TIOCSWINSZ=9999))
    monkeypatch.setattr(
        mod,
        "struct",
        types.SimpleNamespace(pack=lambda fmt, r, c, x, y: b"packed"),
    )
    monkeypatch.setattr(
        mod,
        "fcntl",
        types.SimpleNamespace(
            fcntl=_fake_fcntl, F_GETFL=1, F_SETFL=2, ioctl=_fake_ioctl
        ),
    )

    kills: list[tuple[int, int]] = []
    monkeypatch.setattr(
        mod.os, "kill", lambda pid, sig: kills.append((pid, sig))
    )
    monkeypatch.setattr(mod.os, "chdir", lambda _: None)

    # Act
    s = mod.UnixSession(Path("."))

    # Assert: non-blocking set and initial resize triggers ioctl + SIGWINCH
    assert isinstance(s, mod.BaseSession)
    # F_SETFL recorded
    assert any(call[1] == mod.fcntl.F_SETFL for call in fcntl_calls)
    # ioctl called for win size
    assert any(call[1] == mod.termios.TIOCSWINSZ for call in ioctl_calls)
    # SIGWINCH sent
    assert any(sig == signal.SIGWINCH for (_, sig) in kills)


@unix_only
@pytest.mark.asyncio
async def test_unix_session_read_non_blocking_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from waldiez_studio.utils.terminal_session import unix_session as mod

    fake_pid, fake_fd = 123, 9
    monkeypatch.setattr(
        mod, "pty", types.SimpleNamespace(fork=lambda: (fake_pid, fake_fd))
    )

    # fast-forward init dependencies
    monkeypatch.setattr(
        mod,
        "fcntl",
        types.SimpleNamespace(
            fcntl=lambda *a, **k: 0,
            F_GETFL=1,
            F_SETFL=2,
            ioctl=lambda *a, **k: None,
        ),
    )
    monkeypatch.setattr(mod, "termios", types.SimpleNamespace(TIOCSWINSZ=9999))
    monkeypatch.setattr(
        mod, "struct", types.SimpleNamespace(pack=lambda *a, **k: b"")
    )
    monkeypatch.setattr(mod.os, "kill", lambda *a, **k: None)
    monkeypatch.setattr(mod.os, "chdir", lambda *a, **k: None)

    # os.read => BlockingIOError -> returns b""
    def _fake_read(fd: Any, n: int) -> None:
        raise BlockingIOError

    monkeypatch.setattr(mod.os, "read", _fake_read)

    s = mod.UnixSession(Path("."))
    out = await s.read(4096)
    assert out == b""


@unix_only
def test_unix_session_write_resize_interrupt_terminate_close(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from waldiez_studio.utils.terminal_session import unix_session as mod

    fake_pid, fake_fd = 999, 7
    monkeypatch.setattr(
        mod, "pty", types.SimpleNamespace(fork=lambda: (fake_pid, fake_fd))
    )
    monkeypatch.setattr(mod, "termios", types.SimpleNamespace(TIOCSWINSZ=9999))
    monkeypatch.setattr(
        mod, "struct", types.SimpleNamespace(pack=lambda *a, **k: b"sz")
    )
    # minimal fcntl to pass init
    monkeypatch.setattr(
        mod,
        "fcntl",
        types.SimpleNamespace(
            fcntl=lambda *a, **k: 0,
            F_GETFL=1,
            F_SETFL=2,
            ioctl=lambda *a, **k: None,
        ),
    )
    monkeypatch.setattr(mod.os, "chdir", lambda *a, **k: None)

    writes: list[tuple[Any, Any]] = []
    monkeypatch.setattr(
        mod.os, "write", lambda fd, data: writes.append((fd, data))
    )

    kills: list[tuple[Any, Any]] = []
    monkeypatch.setattr(
        mod.os, "kill", lambda pid, sig: kills.append((pid, sig))
    )

    closes: list[Any] = []
    monkeypatch.setattr(mod.os, "close", closes.append)

    s = mod.UnixSession(Path("."))

    # write
    s.write(b"echo test\n")
    assert writes and writes[-1][1] == b"echo test\n"

    # resize
    s.resize(50, 120)
    assert any(sig == signal.SIGWINCH for (_, sig) in kills)

    # interrupt
    s.interrupt()
    assert any(sig == signal.SIGINT for (_, sig) in kills)

    # terminate
    s.terminate()
    assert any(sig == signal.SIGTERM for (_, sig) in kills)

    # close
    s.close()
    assert fake_fd in closes
    assert any(sig == signal.SIGHUP for (_, sig) in kills)


@unix_only
def test_unix_session_is_alive(monkeypatch: pytest.MonkeyPatch) -> None:
    from waldiez_studio.utils.terminal_session import unix_session as mod

    fake_pid, fake_fd = 1, 2
    monkeypatch.setattr(
        mod, "pty", types.SimpleNamespace(fork=lambda: (fake_pid, fake_fd))
    )
    monkeypatch.setattr(mod, "termios", types.SimpleNamespace(TIOCSWINSZ=1))
    monkeypatch.setattr(
        mod, "struct", types.SimpleNamespace(pack=lambda *a, **k: b"")
    )
    monkeypatch.setattr(
        mod,
        "fcntl",
        types.SimpleNamespace(
            fcntl=lambda *a, **k: 0,
            F_GETFL=1,
            F_SETFL=2,
            ioctl=lambda *a, **k: None,
        ),
    )
    monkeypatch.setattr(mod.os, "chdir", lambda *a, **k: None)
    monkeypatch.setattr(mod.os, "kill", lambda *a, **k: None)

    # First: alive (waitpid returns (0,0))
    monkeypatch.setattr(mod.os, "waitpid", lambda pid, flags: (0, 0))
    s = mod.UnixSession(Path("."))
    assert s.is_alive() is True

    # Then: not alive (non-zero)
    monkeypatch.setattr(mod.os, "waitpid", lambda pid, flags: (pid, 1))
    assert s.is_alive() is False
