# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Configuration module for Waldiez Studio."""

from .lib import get_default_domain_name, get_default_host, get_default_port
from .settings import Settings, get_settings

__all__ = [
    "Settings",
    "get_settings",
    "get_default_domain_name",
    "get_default_host",
    "get_default_port",
]
