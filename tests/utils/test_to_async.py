# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2026 Waldiez and contributors.

"""Tests for waldiez_studio.utils.sync."""

# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,missing-yield-doc,missing-param-doc,missing-raises-doc,line-too-long

import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import pytest

from waldiez_studio.utils.sync import sync_to_async


def add(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b


def raise_exception() -> None:
    """Raise an exception."""
    raise ValueError("An error occurred")


def blocking_function(delay: float) -> str:
    """Block for a specified time."""
    time.sleep(delay)
    return f"Slept for {delay} seconds"


@pytest.mark.asyncio
async def test_sync_to_async_add() -> None:
    """Test running a simple synchronous function asynchronously."""
    async_add = sync_to_async(add)
    result = await async_add(3, 4)
    assert result == 7


@pytest.mark.asyncio
async def test_sync_to_async_exception() -> None:
    """Test handling of exceptions raised in the synchronous function."""
    async_raise_exception = sync_to_async(raise_exception)
    with pytest.raises(ValueError, match="An error occurred"):
        await async_raise_exception()


@pytest.mark.asyncio
async def test_sync_to_async_blocking_function() -> None:
    """Test running a blocking synchronous function asynchronously."""
    async_blocking_function = sync_to_async(blocking_function)
    delay = 0.5
    start_time = time.time()
    result = await async_blocking_function(delay)
    end_time = time.time()
    assert result == f"Slept for {delay} seconds"
    assert end_time - start_time >= delay


@pytest.mark.asyncio
async def test_sync_to_async_with_no_event_loop() -> None:
    """Test running the function when no event loop exists."""
    async_add = sync_to_async(add)

    async def run_without_loop() -> int:
        """Run the function without an event loop."""
        asyncio.set_event_loop(None)
        return await async_add(1, 2)

    result = await run_without_loop()
    assert result == 3


@pytest.mark.asyncio
async def test_sync_to_async_multiple_calls() -> None:
    """Test running the same asynchronous wrapper multiple times."""
    async_add = sync_to_async(add)
    results = await asyncio.gather(
        async_add(1, 2), async_add(3, 4), async_add(5, 6)
    )
    assert results == [3, 7, 11]


@pytest.mark.asyncio
async def test_sync_to_async_no_args() -> None:
    """Test running a synchronous function with no arguments."""

    def no_arg_func() -> str:
        """Return a string."""
        return "Hello, World!"

    async_no_arg_func = sync_to_async(no_arg_func)
    result = await async_no_arg_func()
    assert result == "Hello, World!"


@pytest.mark.asyncio
async def test_sync_to_async_with_kwargs() -> None:
    """Test running a synchronous function with keyword arguments."""

    def greet(name: str, punctuation: str = ".") -> str:
        """Greet the person."""
        return f"Hello, {name}{punctuation}"

    async_greet = sync_to_async(greet)
    result = await async_greet("Alice", punctuation="!")
    assert result == "Hello, Alice!"


def test_sync_to_async_no_event_loop_fallback() -> None:
    """Test the synchronous fallback when no event loop is running."""

    async_add = sync_to_async(add)
    with patch("asyncio.get_running_loop") as mock_get_loop:
        mock_get_loop.side_effect = RuntimeError("no running event loop")
        coro = async_add(5, 10)
        result = asyncio.run(coro)
        mock_get_loop.assert_called_once()
        assert result == 15


async def dummy_add(a: int, b: int) -> int:
    await asyncio.sleep(0)
    return a + b


@pytest.mark.asyncio
async def test_sync_to_async_already_async() -> None:
    """Test passing an async func to sync_to_async."""
    result = await sync_to_async(dummy_add)(1, 2)
    assert result == 3


@pytest.mark.asyncio
async def test_sync_to_async_with_executor() -> None:
    """Test running a synchronous function using an executor."""

    def cpu_bound_task(n: int) -> int:
        """Simulate a CPU-bound task."""
        total = 0
        for i in range(n):
            total += i
        return total

    # Create a custom thread pool executor
    with ThreadPoolExecutor(
        max_workers=2, thread_name_prefix="test-"
    ) as executor:
        async_cpu_bound = sync_to_async(cpu_bound_task, executor=executor)

        # Test that it works with the custom executor
        result = await async_cpu_bound(1000)
        expected = sum(range(1000))
        assert result == expected

        # Test multiple concurrent calls with custom executor
        results = await asyncio.gather(
            async_cpu_bound(100), async_cpu_bound(200), async_cpu_bound(300)
        )

        expected_results = [sum(range(100)), sum(range(200)), sum(range(300))]
        assert results == expected_results
