# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Middleware for additional headers."""
# src/credits:
# https://github.com/fastapi/fastapi/discussions/8548#discussioncomment-5152780

import re
from collections import OrderedDict

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

CSP: dict[str, str | list[str]] = {
    "default-src": "'none'",
    "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net/npm/"],
    "script-src": [
        "'self'",
        "'wasm-unsafe-eval'",
        "https://drag-drop-touch-js.github.io/",
        "https://cdn.jsdelivr.net/npm/",
    ],
    "img-src": ["*", "blob:", "data:"],
    "worker-src": ["'self'", "blob:"],
    "connect-src": "*",
    "font-src": ["'self'", "https://cdn.jsdelivr.net/npm/", "data:"],
    "manifest-src": "'self'",
    "media-src": ["'self'", "data:"],
    "frame-ancestors": ["'self'"],
}


def parse_policy(policy: dict[str, str | list[str]] | str) -> str:
    """Parse a given policy dict to string.

    Parameters
    ----------
    policy : dict[str, str | list[str]] | str
        The policy dict or string

    Returns
    -------
    str
        The parsed policy string
    """
    if isinstance(policy, str):
        # parse the string into a policy dict
        policy_string = policy
        policy = OrderedDict()

        for policy_part in policy_string.split(";"):
            policy_parts = policy_part.strip().split(" ")
            policy[policy_parts[0]] = " ".join(policy_parts[1:])

    policies: list[str] = []
    for section, content in policy.items():
        if not isinstance(content, str):
            content = " ".join(content)
        policy_part = f"{section} {content}"

        policies.append(policy_part)

    parsed_policy = "; ".join(policies)

    return parsed_policy


# pylint: disable=too-few-public-methods
class ExtraHeadersMiddleware:
    """Add extra headers to all responses."""

    def __init__(
        self,
        app: ASGIApp,
        exclude_patterns: list[str] | None = None,
        csp: bool = True,
        force_ssl: bool = True,
        max_age: int = 31556926,
        main_domain: str | None = None,
    ):
        """Init SecurityHeadersMiddleware.

        Parameters
        ----------
        app: ASGIApp
            The ASGI Application
        exclude_patterns: list[str], optional
            List of regex patterns to exclude from adding headers
        csp: bool
            Whether to add a Content-Security-Policy header
        force_ssl: bool
            Whether to add a Strict-Transport-Security header
        max_age: int
            The max age for the Strict-Transport-Security header
        main_domain: str, optional
            The main domain to allow iframes from subdomains
        """
        self.app = app
        self.csp = csp
        self.force_ssl = force_ssl
        self.max_age = max_age
        self.main_domain = main_domain
        self.exclude_patterns = [
            re.compile(p) for p in (exclude_patterns or [])
        ]
        policy = CSP.copy()
        if main_domain:
            policy["frame-ancestors"] = [f"*.{main_domain}"]
        self._policy = parse_policy(policy)

    async def __call__(
        self, scope: Scope, receive: Receive, send: Send
    ) -> None:
        """Call the middleware.

        Parameters
        ----------
        scope : Scope
            The ASGI scope
        receive : Receive
            The ASGI receive channel
        send : Send
            The ASGI send channel
        """
        scope_path = scope.get("path", "")
        scope_type = scope.get("type")
        skip = scope_type != "http"
        # skip = scope.get("type", "") != "http"
        if not skip:
            skip = any(p.search(scope_path) for p in self.exclude_patterns)
        if skip:
            await self.app(scope, receive, send)
        else:

            async def send_wrapper(message: Message) -> None:
                if message["type"] == "http.response.start":
                    headers = MutableHeaders(scope=message)
                    additional_headers = {
                        "Cross-Origin-Opener-Policy": "same-origin",
                        "Referrer-Policy": "strict-origin-when-cross-origin",
                        "X-Content-Type-Options": "nosniff",
                        "X-XSS-Protection": "1; mode=block",
                    }
                    if self.csp:
                        additional_headers["Content-Security-Policy"] = (
                            self._policy
                        )
                    if self.force_ssl:
                        additional_headers["Strict-Transport-Security"] = (
                            f"max-age={self.max_age}; includeSubDomains"
                        )
                    headers.update(additional_headers)
                await send(message)

            await self.app(scope, receive, send_wrapper)
