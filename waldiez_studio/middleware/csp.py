"""Middleware for security."""

# src/credits:
# https://github.com/fastapi/fastapi/discussions/8548#discussioncomment-5152780
from collections import OrderedDict
from typing import Dict, List

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import (
    BaseHTTPMiddleware,
    RequestResponseEndpoint,
)

CSP: dict[str, str | list[str]] = {
    "default-src": "'none'",
    "style-src": ["'self'", "'unsafe-inline'"],
    "script-src": "'self'",
    "img-src": ["'self'", "data:"],
    "worker-src": ["'self'", "blob:"],
    "connect-src": "*",
    "font-src": "'self'",
    "manifest-src": "'self'",
    "media-src": ["'self'", "data:"],
}


def parse_policy(policy: Dict[str, str | List[str]] | str) -> str:
    """Parse a given policy dict to string.

    Parameters
    ----------
    policy : Dict[str, str | List[str]] | str
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

    policies = []
    for section, content in policy.items():
        if not isinstance(content, str):
            content = " ".join(content)
        policy_part = f"{section} {content}"

        policies.append(policy_part)

    parsed_policy = "; ".join(policies)

    return parsed_policy


# pylint: disable=too-few-public-methods
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    def __init__(self, app: FastAPI, csp: bool = True) -> None:
        """Init SecurityHeadersMiddleware.

        Parameters
        ----------
        app: FastAPI
            The FastAPI app
        csp: bool
            Whether to add a Content-Security-Policy header
        """
        super().__init__(app)
        self.csp = csp

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Dispatch of the middleware.

        Parameters
        ----------
        request : Request
            The request
        call_next : RequestResponseEndpoint
            The next call

        Returns
        -------
        Response
            The response
        """
        # if we are on '/docs', skip the middleware
        if request.url.path == "/docs":
            return await call_next(request)
        headers = {
            "Content-Security-Policy": (
                "" if not self.csp else parse_policy(CSP)
            ),
            "Cross-Origin-Opener-Policy": "same-origin",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Strict-Transport-Security": "max-age=31556926; includeSubDomains",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
        }
        response = await call_next(request)
        response.headers.update(headers)

        return response
