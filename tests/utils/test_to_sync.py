# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Tests for waldiez_studio.utils.sync.async_to_sync."""
# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,missing-yield-doc,missing-param-doc,missing-raises-doc,line-too-long

import asyncio
import contextvars
import time
from typing import AsyncGenerator
from unittest.mock import patch

import pytest

from waldiez_studio.utils.sync import async_to_sync

# Test context variable for testing context preservation
test_context_var = contextvars.ContextVar("test_var", default="default")


async def add_async(a: int, b: int) -> int:
    """Add two numbers asynchronously."""
    await asyncio.sleep(0.01)  # Small delay to make it actually async
    return a + b


async def raise_exception_async() -> None:
    """Raise an exception asynchronously."""
    await asyncio.sleep(0.01)
    raise ValueError("An async error occurred")


async def blocking_async_function(delay: float) -> str:
    """Block for a specified time asynchronously."""
    await asyncio.sleep(delay)
    return f"Slept for {delay} seconds"


async def get_context_value() -> str:
    """Get the current context variable value."""
    await asyncio.sleep(0.01)
    return test_context_var.get()


async def no_args_async() -> str:
    """Return a string asynchronously."""
    await asyncio.sleep(0.01)
    return "Hello, Async World!"


async def greet_async(name: str, punctuation: str = ".") -> str:
    """Greet the person asynchronously."""
    await asyncio.sleep(0.01)
    return f"Hello, {name}{punctuation}"


async def async_generator_function() -> str:
    """Function that uses async generators internally."""

    async def gen() -> AsyncGenerator[str, None]:
        yield "item1"
        yield "item2"

    result: list[str] = []
    async for item in gen():
        result.append(item)
    return ",".join(result)


def test_async_to_sync_add() -> None:
    """Test running a simple asynchronous function synchronously."""
    sync_add = async_to_sync(add_async)
    result = sync_add(3, 4)
    assert result == 7


def test_async_to_sync_exception() -> None:
    """Test handling of exceptions raised in the asynchronous function."""
    sync_raise_exception = async_to_sync(raise_exception_async)
    with pytest.raises(ValueError, match="An async error occurred"):
        sync_raise_exception()


def test_async_to_sync_blocking_function() -> None:
    """Test running a blocking asynchronous function synchronously."""
    sync_blocking_function = async_to_sync(blocking_async_function)
    delay = 0.1
    start_time = time.time()
    result = sync_blocking_function(delay)
    end_time = time.time()
    assert result == f"Slept for {delay} seconds"
    assert end_time - start_time >= delay


def test_async_to_sync_no_args() -> None:
    """Test running an asynchronous function with no arguments."""
    sync_no_args = async_to_sync(no_args_async)
    result = sync_no_args()
    assert result == "Hello, Async World!"


def test_async_to_sync_with_kwargs() -> None:
    """Test running an asynchronous function with keyword arguments."""
    sync_greet = async_to_sync(greet_async)
    result = sync_greet("Alice", punctuation="!")
    assert result == "Hello, Alice!"


def test_async_to_sync_no_event_loop() -> None:
    """Test running the function when no event loop exists."""
    sync_add = async_to_sync(add_async)

    # Ensure no event loop is running
    # pylint: disable=too-many-try-statements
    try:
        asyncio.get_running_loop()
        # If we get here, there's a loop, so we need to mock the behavior
        with patch("asyncio.get_running_loop") as mock_get_loop:
            mock_get_loop.side_effect = RuntimeError("no running event loop")
            result = sync_add(1, 2)
            assert result == 3
    except RuntimeError:
        # No loop running, test normally
        result = sync_add(1, 2)
        assert result == 3


@pytest.mark.asyncio
async def test_async_to_sync_from_async_context() -> None:
    """Test running async_to_sync from within an async context."""
    sync_add = async_to_sync(add_async)

    # This should work even though we're already in an async context
    result = sync_add(5, 10)
    assert result == 15


def test_async_to_sync_context_preservation() -> None:
    """Test that context variables are preserved."""
    sync_get_context = async_to_sync(get_context_value)

    # Set a context variable value
    test_value = "test_value_123"
    test_context_var.set(test_value)

    # Call the sync version and verify context is preserved
    result = sync_get_context()
    assert result == test_value


@pytest.mark.asyncio
async def test_async_to_sync_context_preservation_from_async() -> None:
    """Test that context variables are preserved when called from async context."""
    sync_get_context = async_to_sync(get_context_value)

    # Set a context variable value
    test_value = "async_context_test_456"
    test_context_var.set(test_value)

    # Call the sync version from async context
    result = sync_get_context()
    assert result == test_value


def test_async_to_sync_multiple_calls() -> None:
    """Test running the same synchronous wrapper multiple times."""
    sync_add = async_to_sync(add_async)

    # Sequential calls
    results: list[int] = []
    for a, b in [(1, 2), (3, 4), (5, 6)]:
        results.append(sync_add(a, b))

    assert results == [3, 7, 11]


def test_async_to_sync_with_async_generators() -> None:
    """Test that async generators are properly cleaned up."""
    sync_gen_function = async_to_sync(async_generator_function)
    result = sync_gen_function()
    assert result == "item1,item2"


@pytest.mark.asyncio
async def test_async_to_sync_nested_calls() -> None:
    """Test nested calls of async_to_sync from async context."""
    sync_add = async_to_sync(add_async)

    async def wrapper_function() -> int:
        """Wrapper that calls sync function from async context."""
        return sync_add(7, 8)

    result = await wrapper_function()
    assert result == 15


def test_async_to_sync_performance() -> None:
    """Test that async_to_sync doesn't add significant overhead for simple operations."""
    sync_add = async_to_sync(add_async)

    start_time = time.time()
    for i in range(10):
        result = sync_add(i, i + 1)
        assert result == i + (i + 1)
    end_time = time.time()

    # Should complete reasonably quickly (allowing for some overhead)
    assert end_time - start_time < 1.0  # 1 second for 10 calls should be plenty


def test_async_to_sync_error_handling_in_new_loop() -> None:
    """Test error handling when creating new event loop."""
    sync_raise = async_to_sync(raise_exception_async)

    # Should properly propagate exceptions even when creating new loop
    with pytest.raises(ValueError, match="An async error occurred"):
        sync_raise()


@pytest.mark.asyncio
async def test_async_to_sync_concurrent_from_async() -> None:
    """Test concurrent execution of sync functions from async context."""
    sync_add = async_to_sync(add_async)

    async def run_sync_add(a: int, b: int) -> int:
        """Run sync add in an async wrapper."""
        return sync_add(a, b)

    # Run multiple sync functions concurrently from async context
    tasks = [
        asyncio.create_task(run_sync_add(1, 2)),
        asyncio.create_task(run_sync_add(3, 4)),
        asyncio.create_task(run_sync_add(5, 6)),
    ]

    results = await asyncio.gather(*tasks)
    assert results == [3, 7, 11]
