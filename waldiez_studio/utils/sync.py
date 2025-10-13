# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Convert sync functions to async ones and vice-versa."""

import asyncio
import concurrent.futures
import contextvars
from collections.abc import Coroutine
from concurrent.futures import Executor
from functools import partial, wraps
from typing import Any, Callable, TypeVar

try:
    from typing import ParamSpec  # type: ignore[unused-ignore,assignment]
except ImportError:
    from typing_extensions import (  # type: ignore[unused-ignore,assignment]
        ParamSpec,
    )

P = ParamSpec("P")
R = TypeVar("R")


def sync_to_async(
    func: Callable[P, R], executor: Executor | None = None
) -> Callable[P, Coroutine[Any, Any, R]]:
    """Run a synchronous function in an asynchronous way.

    Parameters
    ----------
    func : Callable
        The synchronous function to run asynchronously.
    executor : Executor, Optional
        An optional executor to use

    Returns
    -------
    Callable
        The asynchronous function.
    """
    if asyncio.iscoroutinefunction(func):
        return func

    @wraps(func)
    async def runner(*args: P.args, **kwargs: P.kwargs) -> R:
        """Run the synchronous function in an executor.

        Parameters
        ----------
        *args : Any
            The positional arguments for the function.
        **kwargs : Any
            The keyword arguments for the function.

        Returns
        -------
        R
            The result of the synchronous function executed asynchronously.
        """
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            # No event loop running, execute synchronously
            return func(*args, **kwargs)

        partial_func = partial(func, *args, **kwargs)
        if executor is None:
            # noinspection PyTypeChecker
            return await asyncio.to_thread(partial_func)
        return await loop.run_in_executor(executor, partial_func)

    return runner


def async_to_sync(func: Callable[P, Coroutine[Any, Any, R]]) -> Callable[P, R]:
    """Run an asynchronous function in a synchronous way.

    Parameters
    ----------
    func : Callable
        The asynchronous function to run synchronously.

    Returns
    -------
    Callable
        The synchronous function.
    """

    @wraps(func)
    def run_sync(*args: P.args, **kwargs: P.kwargs) -> R:
        """Run the asynchronous function synchronously.

        Parameters
        ----------
        *args : Any
            The positional arguments for the function.
        **kwargs : Any
            The keyword arguments for the function.

        Returns
        -------
        R
            The result of the asynchronous function executed synchronously.
        """
        try:
            # Check if there's already an event loop running
            asyncio.get_running_loop()
        except RuntimeError:
            # No event loop running, we can create one
            return asyncio.run(func(*args, **kwargs))

        ctx = contextvars.copy_context()

        def _run_in_new_loop() -> R:
            new_loop = asyncio.new_event_loop()
            # pylint: disable=too-many-try-statements
            try:
                asyncio.set_event_loop(new_loop)
                # Create the coroutine *inside* the thread/loop context
                coro = func(*args, **kwargs)
                result = new_loop.run_until_complete(coro)
                # Gracefully shut down asynchronous generators (py>=3.6)
                new_loop.run_until_complete(new_loop.shutdown_asyncgens())
                return result
            finally:
                try:
                    asyncio.set_event_loop(None)
                finally:
                    new_loop.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(lambda: ctx.run(_run_in_new_loop))
            return future.result()

    return run_sync
