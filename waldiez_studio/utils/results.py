# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Utility functions for serializing results from autogen."""

from dataclasses import asdict
from typing import Any

from autogen import ChatResult  # type: ignore[import-untyped]


def serialize_results(
    results: ChatResult | list[ChatResult] | dict[int, ChatResult],
) -> dict[str, Any] | list[dict[str, Any]] | dict[int, dict[str, Any]]:
    """Make results serializable.

    Parameters
    ----------
    results : ChatResult | list[ChatResult] | dict[int, ChatResult]
        The results to serialize.

    Returns
    -------
    dict[str, Any] | list[dict[str, Any]] | dict[int, dict[str, Any]]
        The serializable results.
    """
    if isinstance(results, list):
        return [asdict(r) for r in results]
    if isinstance(results, dict):
        return {k: asdict(v) for k, v in results.items()}
    return asdict(results)
