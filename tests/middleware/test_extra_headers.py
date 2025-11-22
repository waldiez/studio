# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# flake8: noqa
# pyright: reportUnusedFunction=false
# pylint: disable=missing-function-docstring,missing-return-doc,missing-yield-doc,missing-param-doc,missing-raises-doc,line-too-long

"""Tests for the CSP middleware."""

from collections.abc import AsyncGenerator
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from httpx import AsyncClient

# noinspection PyProtectedMember
from httpx._transports.asgi import ASGITransport

from waldiez_studio.middleware.extra_headers import (
    CSP,
    ExtraHeadersMiddleware,
    parse_policy,
)


@pytest.fixture(autouse=True, name="client")
async def get_client() -> AsyncGenerator[AsyncClient, None]:
    """Fixture to create an asynchronous HTTP client for testing."""
    app = FastAPI(docs_url=None, redoc_url=None)

    @app.get("/")
    async def home() -> JSONResponse:
        """Home page."""
        return JSONResponse(content={"message": "Hello, World!"})

    app.add_middleware(ExtraHeadersMiddleware, csp=True)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as api_client:
        yield api_client


@pytest.mark.anyio
async def test_parse_policy_dict() -> None:
    """Test parsing of a policy dictionary into a string."""
    policy_dict: dict[str, Any] = {
        "default-src": "'self'",
        "style-src": ["'self'", "'unsafe-inline'"],
    }
    expected = "default-src 'self'; style-src 'self' 'unsafe-inline'"
    assert parse_policy(policy_dict) == expected


@pytest.mark.anyio
async def test_parse_policy_string() -> None:
    """Test parsing of a policy string ."""
    policy_str = "default-src 'self'; style-src 'self' 'unsafe-inline'"
    assert parse_policy(policy_str) == policy_str


@pytest.mark.anyio
async def test_parse_policy_invalid_type() -> None:
    """Test parsing with an invalid type returns empty string."""
    assert parse_policy({}) == ""


@pytest.mark.anyio
async def test_security_headers_middleware(client: AsyncClient) -> None:
    """Test if middleware adds security headers to responses."""
    response = await client.get("/")

    assert "Content-Security-Policy" in response.headers
    assert response.headers["Content-Security-Policy"] == parse_policy(CSP)
    assert response.headers["Cross-Origin-Opener-Policy"] == "same-origin"
    assert (
        response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    )
    assert (
        response.headers["Strict-Transport-Security"]
        == "max-age=31556926; includeSubDomains"
    )
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-XSS-Protection"] == "1; mode=block"


@pytest.mark.anyio
async def test_security_headers_disabled_csp() -> None:
    """Test middleware when CSP is disabled."""
    app = FastAPI()

    @app.get("/")
    async def home() -> JSONResponse:
        """Home page."""
        return JSONResponse(content={"message": "Hello, World!"})

    app.add_middleware(ExtraHeadersMiddleware, csp=False)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/")

        assert "Content-Security-Policy" not in response.headers


@pytest.mark.anyio
async def test_security_headers_disabled_ssl() -> None:
    """Test middleware when SSL is disabled."""
    app = FastAPI()

    @app.get("/")
    async def home() -> JSONResponse:
        """Home page."""
        return JSONResponse(content={"message": "Hello, World!"})

    app.add_middleware(ExtraHeadersMiddleware, force_ssl=False)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/")

        assert "Strict-Transport-Security" not in response.headers
