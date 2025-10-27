# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# pyright: reportArgumentType=false,reportUnusedParameter=false

"""Application entry point."""

import logging
import mimetypes
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.openapi.docs import (
    get_swagger_ui_html,
    get_swagger_ui_oauth2_redirect_html,
)
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from waldiez_studio._logging import patch_uvicorn_logging
from waldiez_studio._version import __version__
from waldiez_studio.config.settings import get_settings
from waldiez_studio.middleware import ExtraHeadersMiddleware
from waldiez_studio.routes import api_router, ws_router, ws_term_router
from waldiez_studio.utils.extra_static import ensure_extra_static_files
from waldiez_studio.utils.paths import (
    get_static_dir,
    replace_api_prefixes,
    replace_frontend_paths,
)

LOG = logging.getLogger(__name__)

settings = get_settings()
BASE_URL = settings.get_base_url()
STATIC_DIR = get_static_dir()
FRONTEND_DIR = STATIC_DIR / "frontend"
MONACO_DIR = STATIC_DIR / "monaco"
MONACO_VS = MONACO_DIR / "vs"
MONACO_MIN_MAPS = MONACO_DIR / "min-maps"
SWAGGER_DIR = STATIC_DIR / "swagger"
FRONTEND_DIR.mkdir(parents=True, exist_ok=True)
MONACO_DIR.mkdir(parents=True, exist_ok=True)
MONACO_VS.mkdir(parents=True, exist_ok=True)
MONACO_MIN_MAPS.mkdir(parents=True, exist_ok=True)
SWAGGER_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(
    _app: FastAPI,
) -> AsyncIterator[None]:
    """Application lifespan context manager.

    Yields
    ------
    None
        The application lifespan

    Raises
    ------
    RuntimeError
        If the required static files could not be ensured
    """
    try:
        await ensure_extra_static_files(STATIC_DIR)
        LOG.debug("Monaco editor files are ready.")
    except BaseException as e:  # pragma: no cover
        LOG.error("Failed to prepare extra static files.")
        raise RuntimeError("Critical setup step failed.") from e
    patch_uvicorn_logging(settings)
    replace_frontend_paths(static_root=FRONTEND_DIR, base_url=BASE_URL)
    replace_api_prefixes(static_root=FRONTEND_DIR, base_url=BASE_URL)
    yield


app = FastAPI(
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    title="Waldiez Studio",
    description="A simple file manager for Waldiez.",
    version=__version__,
    openapi_url=f"{BASE_URL}/openapi.json",
)

# noinspection PyUnresolvedReferences
swagger_ui_oauth2_redirect_url = (
    app.swagger_ui_oauth2_redirect_url or "/docs/oauth2-redirect"
)

# middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.trusted_origins,
    allow_origin_regex=settings.trusted_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    ProxyHeadersMiddleware,  # type: ignore[arg-type,unused-ignore]
    trusted_hosts=settings.trusted_hosts,
)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.trusted_hosts,
    www_redirect=False,
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    ExtraHeadersMiddleware,
    csp=True,
    exclude_patterns=[
        f"^/{BASE_URL}/docs",
        f"^/{BASE_URL}/openapi.json",
        f"^/{BASE_URL}/favicon.ico",
        f"^/{BASE_URL}/favicon-32x32.png",
        f"^/{BASE_URL}/favicon-64x64.png",
        f"^/{BASE_URL}/apple-touch-icon.png",
        f"^/{BASE_URL}/icons/*",
        f"^/{BASE_URL}/screenshots/*",
        f"^/{BASE_URL}/robots.txt",
        f"^/{BASE_URL}/site.webmanifest",
        f"^/{BASE_URL}/browserconfig.xml",
        f"^/{BASE_URL}/health",
        f"^/{BASE_URL}/healthz",
    ],
    force_ssl=settings.force_ssl,
    max_age=31556926,
)


# self-hosted Swagger UI
@app.get(f"{BASE_URL}/docs", include_in_schema=False)
async def custom_swagger_ui_html() -> HTMLResponse:
    """Get the custom Swagger UI HTML page.

    Returns
    -------
    HTMLResponse
        The custom Swagger UI HTML page
    """
    # noinspection PyUnresolvedReferences
    return get_swagger_ui_html(
        openapi_url=app.openapi_url or "/openapi.json",
        title=app.title + " - Swagger UI",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        swagger_js_url=f"{BASE_URL}/swagger/js/swagger-ui-bundle.js",
        swagger_css_url=f"{BASE_URL}/swagger/css/swagger-ui.css",
        swagger_favicon_url=f"{BASE_URL}/frontend/favicon.ico",
    )


@app.get(f"{BASE_URL}/docs/", include_in_schema=False)
async def redirect_docs() -> Response:
    """Redirect to the custom Swagger UI HTML page.

    Returns
    -------
    Response
        The redirect to the custom Swagger UI HTML page
    """
    return RedirectResponse(url=f"{BASE_URL}/docs")


@app.get(swagger_ui_oauth2_redirect_url, include_in_schema=False)
async def swagger_ui_redirect() -> HTMLResponse:  # pragma: no cover
    """Redirect to the Swagger UI OAuth2 page.

    Returns
    -------
    HTMLResponse
        The Swagger UI OAuth2 page
    """
    return get_swagger_ui_oauth2_redirect_html()


# mount static files
app.mount(f"{BASE_URL}/vs", StaticFiles(directory=MONACO_VS), name="vs")
app.mount(
    f"{BASE_URL}/min-maps",
    StaticFiles(directory=MONACO_MIN_MAPS),
    name="min-maps",
)

app.mount(
    f"{BASE_URL}/swagger",
    StaticFiles(directory=SWAGGER_DIR),
    name="swagger",
)

# include api routes
app.include_router(api_router, prefix=f"{BASE_URL}/api")
app.include_router(ws_router, prefix=BASE_URL)
app.include_router(ws_term_router, prefix=BASE_URL)


# common routes
@app.get(f"{BASE_URL}/robots.txt", include_in_schema=False)
async def robots() -> Response:
    """Serve the robots.txt file.

    Returns
    -------
    Response
        The robots.txt file
    """
    return FileResponse(FRONTEND_DIR / "robots.txt")


@app.get(f"{BASE_URL}/favicon.ico", include_in_schema=False)
async def favicon() -> Response:
    """Serve the favicon.

    Returns
    -------
    Response
        The favicon file

    """
    return FileResponse(FRONTEND_DIR / "favicon.ico")


@app.get("/health/", include_in_schema=False)
@app.get("/healthz/", include_in_schema=False)
@app.get(f"{BASE_URL}/health/", include_in_schema=False)
@app.get(f"{BASE_URL}/healthz/", include_in_schema=False)
@app.get("/health", include_in_schema=False)
@app.get("/healthz", include_in_schema=False)
@app.get(f"{BASE_URL}/health", include_in_schema=False)
@app.get(f"{BASE_URL}/healthz", include_in_schema=False)
async def health_check() -> Response:
    """Health check.

    Returns
    -------
    Response
        The health check
    """
    return Response(status_code=200)


# mount frontend static files
mimetypes.add_type("application/manifest+json", ".webmanifest")
app.mount(
    f"{BASE_URL}/frontend",
    StaticFiles(directory=FRONTEND_DIR),
    name="frontend",
)

if BASE_URL not in ("", "/"):  # pragma: no cover

    @app.get("/", include_in_schema=False)
    @app.get("", include_in_schema=False)
    async def redirect_to_base_url() -> Response:
        """Redirect to base url.

        Returns
        -------
        Response
            The redirection
        """
        return RedirectResponse(BASE_URL)


# pylint: disable=unused-argument
# noinspection PyUnusedLocal
@app.get(f"{BASE_URL}/{{full_path:path}}", include_in_schema=False)
async def catch_all(full_path: str = "") -> Response:
    """Serve the frontend's index.html.

    Parameters
    ----------
    full_path : str
        The full request path

    Returns
    -------
    Response
        The frontend
    """
    return FileResponse(FRONTEND_DIR / "index.html")
