"""Tests for waldiez_studio.utils.to_async."""

# pylint: disable=missing-function-docstring,missing-return-doc,missing-yield-doc,missing-param-doc,missing-raises-doc,line-too-long

import asyncio
import time
from functools import partial
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from waldiez_studio.utils.to_async import sync_to_async


# A sample synchronous function to test
def add(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b


# A synchronous function that raises an exception
def raise_exception() -> None:
    """Raise an exception."""
    raise ValueError("An error occurred")


# A synchronous function to test blocking operations
def blocking_function(delay: int) -> str:
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
    delay = 1
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


@pytest.mark.asyncio
async def test_sync_to_async_loop_closure() -> None:
    """Test that a new event loop is created and properly closed."""

    def test_func(x: int) -> int:
        """Return x + 1."""
        return x + 1

    async_test_func = sync_to_async(test_func)

    with (
        patch(
            "asyncio.get_running_loop",
            side_effect=RuntimeError("No running loop"),
        ),
        patch("asyncio.new_event_loop") as mock_new_event_loop,
        patch("asyncio.set_event_loop") as mock_set_event_loop,
    ):
        # Mock a new loop and configure AsyncMock
        mock_loop = MagicMock()
        mock_loop.run_in_executor = AsyncMock(return_value=43)
        mock_loop.close = (
            MagicMock()
        )  # Ensure `close` is treated as a synchronous method
        mock_new_event_loop.return_value = mock_loop

        # Call the async_test_func
        result = await async_test_func(42)

        # Assertions
        mock_new_event_loop.assert_called_once()  # Ensure new loop created
        mock_set_event_loop.assert_any_call(mock_loop)  # Set new loop
        mock_set_event_loop.assert_any_call(None)  # Reset loop to None

        # Verify `run_in_executor` call with `partial` object
        expected_partial = partial(test_func, 42)
        mock_loop.run_in_executor.assert_awaited_once()
        # Check that the partial object matches the expected function and arguments
        actual_partial = mock_loop.run_in_executor.await_args[0][1]  # type: ignore
        # pylint: disable=no-member
        assert actual_partial.func == expected_partial.func
        assert actual_partial.args == expected_partial.args

        mock_loop.close.assert_called_once()  # Ensure loop closed

        # Validate the result
        assert result == 43
