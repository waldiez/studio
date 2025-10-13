# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# pyright: reportUnusedParameter=false

"""Base abstract terminal session to inherit."""

import abc


class BaseSession(abc.ABC):
    """Base session class."""

    @abc.abstractmethod
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
        raise NotImplementedError

    @abc.abstractmethod
    def write(self, data: bytes) -> None:
        """Write.

        Parameters
        ----------
        data : bytes
            The data to pass.
        """
        raise NotImplementedError

    def resize(self, rows: int, cols: int) -> None:
        """Resize the terminal.

        Parameters
        ----------
        rows : int
            The new number of rows.
        cols : int
            The new number of columns.
        """

    def interrupt(self) -> None:
        """Interrupt the session."""

    def terminate(self) -> None:
        """Terminate the session."""

    # pylint: disable=no-self-use
    def is_alive(self) -> bool:
        """Check if the session is alive.

        Returns
        -------
        bool
            True if the session is alive, false otherwise.
        """
        return False

    def close(self) -> None:
        """Close the session."""
