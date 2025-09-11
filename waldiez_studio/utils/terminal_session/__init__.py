# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.
# pylint: disable=broad-exception-caught,too-complex,import-error
# flake8: noqa: C901
"""Terminal session."""

import sys
from pathlib import Path

from .base import BaseSession


def get_session(workdir: Path) -> BaseSession:  # pragma: no cover
    """Get a session based on the host's os.

    Parameters
    ----------
    workdir : Path
        The path to start the session with.

    Returns
    -------
    BaseSession
        A session based on the host's os.
    """
    # pylint: disable=import-outside-toplevel
    if sys.platform == "win32":
        from .windows_session import WindowsSession

        return WindowsSession(workdir)
    from .unix_session import UnixSession

    return UnixSession(workdir)


__all__ = [
    "BaseSession",
    "get_session",
]
