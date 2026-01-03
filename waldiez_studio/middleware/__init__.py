# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2026 Waldiez and contributors.

"""Custom middlewares for the waldiez_studio project."""

from .extra_headers import ExtraHeadersMiddleware

__all__ = ["ExtraHeadersMiddleware"]
