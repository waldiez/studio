"""Run a synchronous function in an asynchronous way."""

import asyncio
from functools import partial, wraps
from typing import Any, Callable, Coroutine, TypeVar

try:
    from typing import ParamSpec  # type: ignore[unused-ignore,assignment]
except ImportError:
    from typing_extensions import (  # type: ignore[unused-ignore,assignment]
        ParamSpec,
    )

P = ParamSpec("P")
R = TypeVar("R")


def sync_to_async(func: Callable[P, R]) -> Callable[P, Coroutine[Any, Any, R]]:
    """Run a synchronous function in an asynchronous way.

    Parameters
    ----------
    func : Callable
        The synchronous function to run asynchronously.

    Returns
    -------
    Callable
        The asynchronous function.
    """

    @wraps(func)
    async def run_in_executor(*args: P.args, **kwargs: P.kwargs) -> R:
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
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                partial_func = partial(func, *args, **kwargs)
                return await loop.run_in_executor(None, partial_func)
            finally:
                loop.close()
                asyncio.set_event_loop(None)
        else:
            partial_func = partial(func, *args, **kwargs)
            return await loop.run_in_executor(None, partial_func)

    return run_in_executor
