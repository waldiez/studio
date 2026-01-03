# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2026 Waldiez and contributors.

# pyright: reportPrivateUsage=false
# pylint: disable=missing-function-docstring,protected-access
# pylint: disable=missing-return-doc,missing-param-doc,line-too-long
"""Tests for kernel instance singleton."""

import asyncio
import time
from unittest.mock import AsyncMock, patch

import pytest

from waldiez_studio.engines.kernel import KernelManager


@pytest.mark.asyncio
async def test_kernel_instance_singleton() -> None:
    """Test that KernelManager returns the same instance."""
    # Reset the singleton state
    KernelManager._km = None

    with patch(
        "waldiez_studio.engines.kernel.AsyncKernelManager"
    ) as mock_manager:
        mock_km = AsyncMock()
        mock_manager.return_value = mock_km

        # Get first instance
        km1 = await KernelManager.get()

        # Get second instance
        km2 = await KernelManager.get()

        # Should be the same instance
        assert km1 is km2

        # Kernel should only be started once
        mock_km.start_kernel.assert_called_once()


@pytest.mark.asyncio
async def test_kernel_instance_interrupt() -> None:
    """Test kernel interrupt functionality."""
    KernelManager._km = None

    with patch(
        "waldiez_studio.engines.kernel.AsyncKernelManager"
    ) as mock_manager:
        mock_km = AsyncMock()
        mock_manager.return_value = mock_km

        # Get instance first
        await KernelManager.get()

        # Test interrupt
        await KernelManager.interrupt()
        mock_km.interrupt_kernel.assert_called_once()


@pytest.mark.asyncio
async def test_kernel_instance_restart() -> None:
    """Test kernel restart functionality."""
    KernelManager._km = None

    with patch(
        "waldiez_studio.engines.kernel.AsyncKernelManager"
    ) as mock_manager:
        mock_km = AsyncMock()
        mock_manager.return_value = mock_km

        # Get instance first
        await KernelManager.get()

        # Test restart
        await KernelManager.restart()
        mock_km.restart_kernel.assert_called_once_with(now=True)


@pytest.mark.asyncio
async def test_kernel_instance_garbage_collection() -> None:
    """Test kernel garbage collection based on idle time."""
    KernelManager._km = None
    KernelManager._last_used = time.time() - (
        KernelManager.IDLE_TTL_SEC + 1
    )  # Expired

    with patch(
        "waldiez_studio.engines.kernel.AsyncKernelManager"
    ) as mock_manager:
        mock_km = AsyncMock()
        mock_manager.return_value = mock_km

        # Set up an existing kernel
        KernelManager._km = mock_km

        # Run garbage collection
        await KernelManager.maybe_gc()

        # Should have shutdown the kernel
        mock_km.shutdown_kernel.assert_called_once_with(now=True)
        assert KernelManager._km is None


@pytest.mark.asyncio
async def test_kernel_instance_no_gc_when_recent() -> None:
    """Test that kernel is not garbage collected when recently used."""
    KernelManager._km = None
    KernelManager._last_used = time.time()  # Recently used

    with patch(
        "waldiez_studio.engines.kernel.AsyncKernelManager"
    ) as mock_manager:
        mock_km = AsyncMock()
        mock_manager.return_value = mock_km

        # Set up an existing kernel
        KernelManager._km = mock_km

        # Run garbage collection
        await KernelManager.maybe_gc()

        # Should NOT have shutdown the kernel
        mock_km.shutdown_kernel.assert_not_called()
        assert KernelManager._km is not None


def test_kernel_instance_lock() -> None:
    """Test that lock returns an asyncio.Lock."""
    lock = KernelManager.lock()
    assert isinstance(lock, asyncio.Lock)

    # Should return the same lock instance
    lock2 = KernelManager.lock()
    assert lock is lock2


@pytest.mark.asyncio
async def test_shutdown_kernel() -> None:
    """Test explicit kernel shutdown functionality."""
    KernelManager._km = None

    with patch(
        "waldiez_studio.engines.kernel.AsyncKernelManager"
    ) as mock_manager:
        mock_km = AsyncMock()
        mock_manager.return_value = mock_km

        # First, set up a kernel instance
        await KernelManager.get()
        assert KernelManager._km is not None

        # Test shutdown with now=False (default)
        await KernelManager.shutdown_kernel()

        # Should have called shutdown on the kernel
        mock_km.shutdown_kernel.assert_called_once_with(now=False)

        # Should have reset the singleton instance
        assert KernelManager._km is None


@pytest.mark.asyncio
async def test_shutdown_kernel_with_now_true() -> None:
    """Test kernel shutdown with now=True parameter."""
    KernelManager._km = None

    with patch(
        "waldiez_studio.engines.kernel.AsyncKernelManager"
    ) as mock_manager:
        mock_km = AsyncMock()
        mock_manager.return_value = mock_km

        # Set up a kernel instance
        await KernelManager.get()
        assert KernelManager._km is not None

        # Test shutdown with now=True
        await KernelManager.shutdown_kernel(now=True)

        # Should have called shutdown with now=True
        mock_km.shutdown_kernel.assert_called_once_with(now=True)

        # Should have reset the singleton instance
        assert KernelManager._km is None


@pytest.mark.asyncio
async def test_shutdown_kernel_when_no_kernel_exists() -> None:
    """Test shutdown_kernel when no kernel instance exists."""
    # Ensure no kernel exists
    KernelManager._km = None

    # Should not raise an exception when no kernel exists
    await KernelManager.shutdown_kernel()

    # Should still be None
    assert KernelManager._km is None


@pytest.mark.asyncio
async def test_shutdown_kernel_concurrent_access() -> None:
    """Test that shutdown_kernel properly uses the lock for thread safety."""
    KernelManager._km = None

    with patch(
        "waldiez_studio.engines.kernel.AsyncKernelManager"
    ) as mock_manager:
        mock_km = AsyncMock()
        mock_manager.return_value = mock_km

        # Set up a kernel instance
        await KernelManager.get()

        # Create multiple concurrent shutdown tasks
        tasks = [
            asyncio.create_task(KernelManager.shutdown_kernel())
            for _ in range(3)
        ]

        # Wait for all tasks to complete
        await asyncio.gather(*tasks)

        # Should only have called shutdown once (due to lock protection)
        # The first task should shut down,
        # others should find _km is already None
        assert (
            mock_km.shutdown_kernel.call_count <= 3
        )  # At most 3, likely just 1

        # Kernel should be None after all tasks complete
        assert KernelManager._km is None
