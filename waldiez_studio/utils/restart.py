# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.
"""Restart the Waldiez Studio process."""

import logging
import os
import shlex
import sys

LOG = logging.getLogger(__name__)


def restart_process() -> None:  # pragma: no cover
    """Restart the current process with the same command line arguments."""
    to_call = [
        sys.executable,
        "-m",
        "waldiez_studio",
    ] + skip_positional_prefix(sys.argv[1:])
    to_log = " ".join(shlex.quote(arg) for arg in to_call)
    LOG.info("Restarting process with command: %s", to_log)
    os.execv(sys.executable, to_call)  # nosemgrep # nosec


def skip_positional_prefix(argv: list[str]) -> list[str]:
    """Skip all leading args until the first option/flag (starts with '-').

    Parameters
    ----------
    argv : list[str]
        The command line arguments.
    Returns
    -------
    list[str]
        The arguments starting from the first option/flag.
    """
    for i, arg in enumerate(argv):
        if arg.startswith("-"):
            return argv[i:]
    return []
