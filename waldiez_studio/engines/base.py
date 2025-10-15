# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Abstract execution engine interface."""

import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from fastapi import WebSocket


class Engine(ABC):
    """Abstract execution engine interface."""

    file_path: Path
    root_dir: Path
    websocket: WebSocket

    def __init__(
        self, *, file_path: Path, root_dir: Path, websocket: WebSocket
    ) -> None:
        self.file_path = file_path
        self.root_dir = root_dir
        self.websocket = websocket
        self.log = logging.getLogger(self.__class__.__name__)

    @abstractmethod
    async def start(self, start_msg: dict[str, Any] | None = None) -> None:
        """Start the run (after receiving the initial 'op=start' message).

        Parameters
        ----------
        start_msg : dict[str, Any]
            Optional start arguments to pass.
        """

    @abstractmethod
    async def handle_client(self, msg: dict[str, Any]) -> None:
        """Handle subsequent client control messages (stdin/interrupt/etc.).

        Parameters
        ----------
        msg : dict[str, Any]
            Message from the client.
        """

    @abstractmethod
    async def shutdown(self) -> None:
        """Finalize the run and emit 'run_end' if appropriate."""
