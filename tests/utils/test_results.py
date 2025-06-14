# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,
# pylint: disable=missing-yield-doc,missing-param-doc
""" "Tests for waldiez_studio.utils.results."""

from autogen import ChatResult  # type: ignore[import-untyped]

from waldiez_studio.utils.results import serialize_results


def test_serialize_results_single_result() -> None:
    """Test serialization of a single ChatResult."""
    result = ChatResult(
        chat_id=1,
        chat_history=[
            {"role": "user", "content": "Hello, how are you?"},
            {"role": "assistant", "content": "I am fine, thank you!"},
        ],
        summary="This is a summary",
        cost={
            "total": {"amount": 10.0, "currency": "USD"},
            "per_message": {"amount": 0.1, "currency": "USD"},
        },
        human_input=["Hello, how are you?"],
    )
    serialized = serialize_results(result)
    assert isinstance(serialized, dict)
    assert serialized["chat_id"] == 1  # type: ignore
    assert serialized["chat_history"] == [  # type: ignore
        {"role": "user", "content": "Hello, how are you?"},
        {"role": "assistant", "content": "I am fine, thank you!"},
    ]


def test_serialize_results_list() -> None:
    """Test serialization of a list of ChatResults."""
    results = [
        ChatResult(
            chat_id=1,
            chat_history=[{"role": "user", "content": "Hello!"}],
            summary="Summary 1",
            cost={"total": {"amount": 5.0, "currency": "USD"}},
            human_input=["Hello!"],
        ),
        ChatResult(
            chat_id=2,
            chat_history=[{"role": "user", "content": "Hi!"}],
            summary="Summary 2",
            cost={"total": {"amount": 7.0, "currency": "USD"}},
            human_input=["Hi!"],
        ),
    ]
    serialized = serialize_results(results)
    assert isinstance(serialized, list)
    assert len(serialized) == 2
    assert serialized[0]["chat_id"] == 1
    assert serialized[1]["chat_id"] == 2


def test_serialize_results_dict() -> None:
    """Test serialization of a dictionary of ChatResults."""
    results = {
        1: ChatResult(
            chat_id=1,
            chat_history=[{"role": "user", "content": "Hello!"}],
            summary="Summary 1",
            cost={"total": {"amount": 5.0, "currency": "USD"}},
            human_input=["Hello!"],
        ),
        2: ChatResult(
            chat_id=2,
            chat_history=[{"role": "user", "content": "Hi!"}],
            summary="Summary 2",
            cost={"total": {"amount": 7.0, "currency": "USD"}},
            human_input=["Hi!"],
        ),
    }
    serialized = serialize_results(results)
    assert isinstance(serialized, dict)
    assert len(serialized) == 2
    assert serialized[1]["chat_id"] == 1  # type: ignore
    assert serialized[2]["chat_id"] == 2  # type: ignore


def test_serialize_results_empty() -> None:
    """Test serialization of an empty result."""
    results = ChatResult()
    serialized = serialize_results(results)
    assert isinstance(serialized, dict)
    assert not serialized["chat_id"]  # type: ignore
    assert not serialized["chat_history"]  # type: ignore
    assert not serialized["summary"]  # type: ignore
