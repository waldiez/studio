# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,missing-yield-doc,missing-param-doc,missing-raises-doc,line-too-long

"""Tests for the CSP middleware."""

from typing import Any, AsyncGenerator, Dict

import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from httpx import AsyncClient
from httpx._transports.asgi import ASGITransport

from waldiez_studio.middleware.csp import (
    CSP,
    SecurityHeadersMiddleware,
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

    @app.get("/docs")
    async def docs() -> JSONResponse:
        """Docs page."""
        return JSONResponse(content={"message": "Docs page"})

    app.add_middleware(SecurityHeadersMiddleware, csp=True)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as api_client:
        yield api_client


@pytest.mark.asyncio
async def test_parse_policy_dict() -> None:
    """Test parsing of a policy dictionary into a string."""
    policy_dict: Dict[str, Any] = {
        "default-src": "'self'",
        "style-src": ["'self'", "'unsafe-inline'"],
    }
    expected = "default-src 'self'; style-src 'self' 'unsafe-inline'"
    assert parse_policy(policy_dict) == expected


@pytest.mark.asyncio
async def test_parse_policy_string() -> None:
    """Test parsing of a policy string into a dictionary and back to string."""
    policy_str = "default-src 'self'; style-src 'self' 'unsafe-inline'"
    assert parse_policy(policy_str) == policy_str


@pytest.mark.asyncio
async def test_parse_policy_invalid_type() -> None:
    """Test parsing with an invalid type raises no error but returns empty string."""
    assert parse_policy({}) == ""


@pytest.mark.asyncio
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
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-XSS-Protection"] == "1; mode=block"


@pytest.mark.asyncio
async def test_middleware_skips_docs(client: AsyncClient) -> None:
    """Test middleware skips headers for /docs endpoint."""
    response = await client.get("/docs")

    assert "Content-Security-Policy" not in response.headers
    assert "Cross-Origin-Opener-Policy" not in response.headers


@pytest.mark.asyncio
async def test_security_headers_disabled_csp() -> None:
    """Test middleware when CSP is disabled."""
    app = FastAPI()

    @app.get("/")
    async def home() -> JSONResponse:
        """Home page."""
        return JSONResponse(content={"message": "Hello, World!"})

    app.add_middleware(SecurityHeadersMiddleware, csp=False)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/")

        assert response.headers["Content-Security-Policy"] == ""
        assert response.headers["X-Frame-Options"] == "DENY"
