# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.
"""Callback enabled IO stream for Waldiez Studio."""

from typing import Any, Callable

from autogen.events import BaseEvent  # type: ignore
from autogen.io import IOStream  # type: ignore


class DelegatedIOStream(IOStream):
    """Delegate the input and output operations to provided callbacks."""

    def __init__(
        self,
        on_input: Callable[..., str],
        on_output: Callable[..., None],
        is_async: bool = False,
        on_send: Callable[[BaseEvent], None] | None = None,
    ) -> None:
        super().__init__()
        self._on_input = on_input
        self._on_output = on_output
        self._on_send = on_send
        self._is_async = is_async

    def print(self, *args: Any, **kwargs: Any) -> None:
        """Prints to the output stream using the provided callback.

        Parameters
        ----------
        *args : Any
            Positional arguments to pass to the output callback.
        **kwargs : Any
            Keyword arguments to pass to the output callback.
        """
        self._on_output(*args, **kwargs)

    def input(self, prompt: str = "", *, password: bool = False) -> str:
        """Structured input from stdin.

        Parameters
        ----------
        prompt : str, optional
            The prompt to display. Defaults to "".
        password : bool, optional
            Whether to read a password. Defaults to False.

        Returns
        -------
        str
            The line read from the input stream.
        """
        # let's keep an eye here:
        # https://github.com/ag2ai/ag2/blob/main/autogen/agentchat/conversable_agent.py#L2973
        # reply = await iostream.input(prompt) ???? (await???)
        if self._is_async:
            # let's make a coroutine to just return the input method
            async def async_input() -> str:
                """Asynchronous input method.

                Returns
                -------
                str
                    The line read from the input stream.
                """
                return self._on_input(prompt=prompt, password=password)

            return async_input()  # type: ignore
        return self._on_input(prompt=prompt, password=password)

    def send(self, message: BaseEvent) -> None:
        """Sends a message to the input stream.

        Parameters
        ----------
        message : BaseEvent
            The message to send.
        """
        if self._on_send:
            self._on_send(message)
        else:
            self.print(
                message.model_dump_json(),
                flush=True,
                end="",
            )
