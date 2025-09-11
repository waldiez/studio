# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Factory to create the appropriate engine."""

from pathlib import Path
from typing import Final

from fastapi import WebSocket

from .base import Engine

SUPPORTED_EXTS: Final[set[str]] = {".py", ".ipynb", ".waldiez"}


# pylint: disable=unused-argument
async def make_engine(
    *,
    file_path: Path,
    root_dir: Path,
    websocket: WebSocket,
) -> Engine:
    """
    Create an engine instance for the given file type.

    - .py      -> SubprocessEngine
    - .ipynb   -> NotebookEngine
    - .waldiez -> WaldiezEngine (compile -> subprocess)

    Parameters
    ----------
    file_path : Path
        The path of the file to run.
    root_dir : Path
        The root directory of the file
    websocket : Websocket
        The websocket to use for communication.

    Raises
    ------
    ValueError
        If the file extension is is not supported.
    NotImplementedError
        Well, this should be removed.

    Returns
    -------
    Engine
        The engine instance for the selected file.
    """
    ext = file_path.suffix.lower()
    if ext not in SUPPORTED_EXTS:
        raise ValueError(f"Unsupported extension: {ext}")
    # pylint: disable=import-outside-toplevel
    # Lazy import.
    if ext == ".py":
        from .subprocess_engine import SubprocessEngine

        return SubprocessEngine(
            file_path=file_path, root_dir=root_dir, websocket=websocket
        )

    if ext == ".ipynb":
        from .notebook_engine import NotebookEngine

        return NotebookEngine(
            file_path=file_path, root_dir=root_dir, websocket=websocket
        )

    if ext == ".waldiez":
        from .waldiez_engine import WaldiezEngine

        return WaldiezEngine(
            file_path=file_path, root_dir=root_dir, websocket=websocket
        )
    raise ValueError(f"Unsupported extension: {ext}")  # pragma: no cover
