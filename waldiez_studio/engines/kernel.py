# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# pyright: reportUnknownMemberType=false

"""Kernel singleton instance."""

import asyncio
import time

from jupyter_client.manager import AsyncKernelManager


class KernelManager:
    """Kernel singleton instance."""

    _km: AsyncKernelManager | None = None
    _lock = asyncio.Lock()
    _last_used = 0.0
    IDLE_TTL_SEC = 15 * 60  # shutdown if idle for 15 min

    @classmethod
    async def get(cls) -> AsyncKernelManager:
        """Get the kernel manager.

        Returns
        -------
        AsyncKernelManager
            The kernel manager.
        """
        async with cls._lock:
            if cls._km is None:
                km = AsyncKernelManager(kernel_name="python3")
                await km.start_kernel()
                cls._km = km
            cls._last_used = time.time()
        return cls._km or AsyncKernelManager(kernel_name="python3")

    @classmethod
    async def interrupt(cls) -> None:
        """Interrupt the kernel."""
        if cls._km:  # pragma: no branch
            await cls._km.interrupt_kernel()

    @classmethod
    async def restart(cls) -> None:
        """Restart the kernel."""
        if cls._km:  # pragma: no branch
            await cls._km.restart_kernel(now=True)

    @classmethod
    async def shutdown_kernel(cls, now: bool = False) -> None:
        """Explicitly shutdown the kernel.

        Parameters
        ----------
        now : bool
            Shutdown now instead of waiting for idle.
        """
        async with cls._lock:
            if cls._km:
                await cls._km.shutdown_kernel(now=now)
                cls._km = None

    @classmethod
    async def maybe_gc(cls) -> None:
        """Call periodically (e.g., in a background task)."""
        if cls._km and time.time() - cls._last_used > cls.IDLE_TTL_SEC:
            await cls._km.shutdown_kernel(now=True)
            cls._km = None

    @classmethod
    def lock(cls) -> asyncio.Lock:
        """Get a lock to use for operations.

        Returns
        -------
        asyncio.Lock
            A lock.
        """
        return cls._lock
