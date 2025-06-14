# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# pyright:reportUnknownVariableType=false
# pylint: disable=missing-function-docstring,missing-return-doc,
# pylint: disable=missing-yield-doc,missing-param-doc,missing-raises-doc
# pylint: disable=no-member,protected-access,unused-argument
""" "Tests for waldiez_studio.utils.delegated_iostream."""

import uuid
from typing import Any
from unittest.mock import MagicMock

import pytest
from autogen.events import BaseEvent  # type: ignore[import-untyped]

from waldiez_studio.utils.delegated_iostream import DelegatedIOStream


def test_print_delegates_to_on_output() -> None:
    """Test that print() delegates to on_output with args and kwargs."""
    mock_output = MagicMock()
    stream = DelegatedIOStream(on_input=MagicMock(), on_output=mock_output)
    stream.print("Hello", "World", sep="|", end="!")

    mock_output.assert_called_once_with("Hello", "World", sep="|", end="!")


def test_input_sync_mode() -> None:
    """Test that input() calls on_input directly in sync mode."""
    mock_input = MagicMock(return_value="user input")
    stream = DelegatedIOStream(
        on_input=mock_input, on_output=MagicMock(), is_async=False
    )
    result = stream.input("Prompt: ", password=True)

    assert result == "user input"
    mock_input.assert_called_once_with(prompt="Prompt: ", password=True)


@pytest.mark.asyncio
async def test_input_async_mode() -> None:
    """Test that input() returns a coroutine when is_async is True."""
    mock_input = MagicMock(return_value="async user input")
    stream = DelegatedIOStream(
        on_input=mock_input, on_output=MagicMock(), is_async=True
    )

    coro = stream.input("Prompt: ", password=False)
    result = await coro  # type: ignore

    assert result == "async user input"
    mock_input.assert_called_once_with(prompt="Prompt: ", password=False)


def test_send_with_on_send() -> None:
    """Test that send() uses on_send callback if provided."""
    mock_send = MagicMock()

    class DummyEvent(BaseEvent):
        """Dummy event class for testing."""

        content: str = "dummy content"

        def model_dump_json(self, *args: Any, **kwargs: Any) -> str:
            """Return a JSON representation of the event."""
            return '{"content": "dummy content"}'

    stream = DelegatedIOStream(
        on_input=MagicMock(),
        on_output=MagicMock(),
        on_send=mock_send,
    )

    event = DummyEvent(uuid=uuid.uuid4())
    stream.send(event)

    mock_send.assert_called_once_with(event)


def test_send_without_on_send_falls_back_to_print() -> None:
    """Test that send() falls back to print() if on_send is not provided."""
    mock_output = MagicMock()

    class DummyEvent(BaseEvent):
        """Dummy event class for testing."""

        def model_dump_json(self, *args: Any, **kwargs: Any) -> str:
            """Return a JSON representation of the event."""
            return "event json"

    stream = DelegatedIOStream(
        on_input=MagicMock(),
        on_output=mock_output,
        on_send=None,
    )

    event = DummyEvent(uuid=uuid.uuid4())
    stream.send(event)

    mock_output.assert_called_once_with("event json", flush=True, end="")
