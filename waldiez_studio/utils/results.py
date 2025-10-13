# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# pylint: disable=broad-exception-caught
# pyright: reportUnknownArgumentType=false,reportArgumentType=false

"""Module for serializing results into a JSON-compatible format."""

import json
from dataclasses import asdict, is_dataclass
from typing import Any


def serialize_dict(data: dict[Any, Any]) -> list[dict[Any, Any]]:
    """Serialize a dictionary into a json-compatible format.

    Parameters
    ----------
    data : dict[Any, Any]
        The dictionary to serialize.

    Returns
    -------
    list[dict[Any, Any]]
        The serialized dictionary with JSON-compatible types.
    """
    serialized: dict[str, Any] = {}
    for key, value in data.items():
        # If value is a dataclass, recursively serialize it
        if is_dataclass_instance(value):  # Check if it's a dataclass
            serialized[key] = serialize_results(
                asdict(value)
            )  # Serialize dataclass object
        elif isinstance(value, dict):  # If it's a nested dict, serialize it
            serialized[key] = serialize_dict(value)[0]
        elif isinstance(value, list):  # If it’s a list, serialize it
            serialized[key] = serialize_list(value)
        else:
            # Primitive types (str, int, float, etc.) are already serializable
            serialized[key] = value
    return [serialized]  # Return as a list


def serialize_list(data: list[Any]) -> list[dict[Any, Any]]:
    """Serialize a list into a list of JSON-compatible dictionaries.

    Parameters
    ----------
    data : list[Any]
        The list to serialize.

    Returns
    -------
    list[dict[Any, Any]]
        The list of serialized items.
    """
    serialized: list[dict[Any, Any]] = []
    for item in data:
        if is_dataclass_instance(
            item
        ):  # If the item is a dataclass, serialize it
            serialized.extend(
                serialize_results(asdict(item))
            )  # Flatten the result
        elif isinstance(
            item, dict
        ):  # If the item is a dictionary, serialize it
            serialized.append(
                serialize_dict(item)[0]
            )  # Ensure it’s wrapped in a list
        elif isinstance(item, list):  # If the item is a list, serialize it
            # Flatten the result
            serialized.extend(serialize_list(item))
        elif isinstance(item, (str, int, float, bool)):
            # Primitive types (str, int, float, bool) are already serializable
            # noinspection PyTypeChecker
            serialized.append(item)  # type: ignore
        elif hasattr(item, "model_dump"):
            # If the item has a model_dump method
            # (e.g., Pydantic models), serialize it
            serialized.append(item.model_dump(mode="json"))
        else:
            serialized.append({"value": json.dumps(item, default=str)})
    return serialized


def serialize_results(results: Any) -> list[dict[Any, Any]]:
    """Make the results JSON serializable.

    Parameters
    ----------
    results : Any
        The results.

    Returns
    -------
    list[dict[Any, Any]]
        The json serializable results.
    """
    if isinstance(results, dict):
        return serialize_dict(results)
    if isinstance(results, list):
        return serialize_list(results)
    if is_dataclass_instance(results):
        return serialize_dict(asdict(results))
    return serialize_results([results])  # pragma: no cover


def is_dataclass_instance(obj: Any) -> bool:
    """Check if an object is an instance of a dataclass.

    Parameters
    ----------
    obj : Any
        The object.

    Returns
    -------
    bool
        True if the object is an instance of a dataclass, False otherwise.
    """
    return is_dataclass(obj) and not isinstance(obj, type)
