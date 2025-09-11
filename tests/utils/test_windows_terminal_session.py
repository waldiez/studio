# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.
"""Test waldiez_studio.utils.terminal_session.*. on windows"""

# pylint: disable=missing-function-docstring,missing-return-doc
# pylint: disable=missing-yield-doc,missing-param-doc,missing-raises-doc
# pylint: disable=unused-argument,no-self-use,
# pylint: disable=protected-access,import-outside-toplevel
# pyright: reportUnknownLambdaType=false,reportUnknownArgumentType=false
# pyright: reportUnknownVariableType=false,reportUnknownMemberType=false
# pyright: reportPrivateUsage=false,reportOperatorIssue=false

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

windows_only = pytest.mark.skipif(
    sys.platform != "win32", reason="Windows-only test"
)


class FakePty:
    """Create a fake pty."""

    def __init__(self) -> None:
        self._written: list[str] = []
        self._size = (80, 24)
        self._alive = True

    def read(self, n: int) -> bytes:
        if self._written:
            return "".join(self._written).encode()
        return "chunk".encode()

    def write(self, s: str) -> None:
        self._written.append(s)

    # cspell: disable-next-line
    def setwinsize(self, cols: int, rows: int) -> None:
        self._size = (cols, rows)

    def terminate(self) -> None:
        self._alive = False

    # cspell: disable-next-line
    def isalive(self) -> bool:
        return self._alive

    def close(self) -> None:
        self._alive = False


@windows_only
def test_win_session_spawns_and_delegates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from waldiez_studio.utils.terminal_session import windows_session as mod

    fake = FakePty()

    monkeypatch.setattr(
        mod,
        "winpty",
        SimpleNamespace(PtyProcess=SimpleNamespace(spawn=lambda *a, **k: fake)),
        raising=True,
    )
    monkeypatch.setattr(mod, "_HAVE_PYWINPTY", True, raising=False)

    s = mod.WindowsSession(Path("."))

    # resize
    s.resize(30, 100)
    assert fake._size == (100, 30)

    # write & interrupt (Ctrl-C) should write single char or similar
    s.write(b"abc")
    s.interrupt()
    assert any("\x03" in w for w in fake._written) or "\x03" in "".join(
        fake._written
    )


@windows_only
@pytest.mark.asyncio
async def test_win_session_read(monkeypatch: pytest.MonkeyPatch) -> None:
    from waldiez_studio.utils.terminal_session import windows_session as mod

    fake = FakePty()
    monkeypatch.setattr(
        mod,
        "winpty",
        SimpleNamespace(PtyProcess=SimpleNamespace(spawn=lambda *a, **k: fake)),
        raising=True,
    )
    monkeypatch.setattr(mod, "_HAVE_PYWINPTY", True, raising=False)

    s = mod.WindowsSession(Path("."))

    out = await s.read(1024)
    assert out == b"chunk"

    assert s.is_alive() is True
    s.terminate()
    assert s.is_alive() is False
