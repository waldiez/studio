# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Module for defining task states using an enumeration."""

from enum import Enum, auto


class TaskState(Enum):
    """Enumeration for task states."""

    NOT_STARTED = auto()
    RUNNING = auto()
    COMPLETED = auto()
