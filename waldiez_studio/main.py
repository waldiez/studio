"""Application entry point."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

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

from waldiez_studio._version import __version__
from waldiez_studio.config.settings import get_settings
from waldiez_studio.middleware import SecurityHeadersMiddleware
from waldiez_studio.routes import api_router, ws_router
from waldiez_studio.utils.extra_static import ensure_extra_static_files
from waldiez_studio.utils.paths import get_static_dir

LOG = logging.getLogger(__name__)

settings = get_settings()

STATIC_DIR = get_static_dir()
FRONTEND_DIR = STATIC_DIR / "frontend"
MONACO_DIR = STATIC_DIR / "monaco"
MONACO_MIN_MAPS = MONACO_DIR / "min-maps"
SWAGGER_DIR = STATIC_DIR / "swagger"
FRONTEND_DIR.mkdir(parents=True, exist_ok=True)
MONACO_DIR.mkdir(parents=True, exist_ok=True)
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
    except BaseException as e:
        LOG.error("Failed to prepare extra static files.")
        raise RuntimeError("Critical setup step failed.") from e
    yield


app = FastAPI(
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    title="Waldiez Studio",
    description="A simple file manager for Waldiez.",
    version=__version__,
    openapi_url="/openapi.json",
)

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
    ProxyHeadersMiddleware,
    trusted_hosts=settings.trusted_hosts,
)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.trusted_hosts,
    www_redirect=False,
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(SecurityHeadersMiddleware, csp=True)


# self-hosted Swagger UI
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html() -> HTMLResponse:
    """Get the custom Swagger UI HTML page.

    Returns
    -------
    HTMLResponse
        The custom Swagger UI HTML page
    """
    return get_swagger_ui_html(
        openapi_url=app.openapi_url or "/openapi.json",
        title=app.title + " - Swagger UI",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        swagger_js_url="/swagger/js/swagger-ui-bundle.js",
        swagger_css_url="/swagger/css/swagger-ui.css",
        swagger_favicon_url="/frontend/favicon.ico",
    )


@app.get("/docs/", include_in_schema=False)
async def redirect_docs() -> Response:
    """Redirect to the custom Swagger UI HTML page.

    Returns
    -------
    Response
        The redirect to the custom Swagger UI HTML page
    """
    return RedirectResponse(url="/docs")


@app.get(swagger_ui_oauth2_redirect_url, include_in_schema=False)
async def swagger_ui_redirect() -> HTMLResponse:
    """Redirect to the Swagger UI OAuth2 page.

    Returns
    -------
    HTMLResponse
        The Swagger UI OAuth2 page
    """
    return get_swagger_ui_oauth2_redirect_html()


# mount static files
app.mount("/monaco", StaticFiles(directory=MONACO_DIR), name="monaco")
app.mount(
    "/min-maps",
    StaticFiles(directory=MONACO_MIN_MAPS),
    name="min-maps",
)

app.mount(
    "/swagger",
    StaticFiles(directory=SWAGGER_DIR),
    name="swagger",
)

# include api routes
app.include_router(api_router, prefix="/api")
app.include_router(ws_router)


# common routes
@app.get("/robots.txt", include_in_schema=False)
async def robots() -> Response:
    """Serve the robots.txt file.

    Returns
    -------
    Response
        The robots.txt file
    """
    return FileResponse(FRONTEND_DIR / "robots.txt")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon() -> Response:
    """Serve the favicon.

    Returns
    -------
    Response
        The favicon file

    """
    return FileResponse(FRONTEND_DIR / "favicon.ico")


@app.get("/health")
@app.get("/healthz")
async def health_check() -> Response:
    """Health check.

    Returns
    -------
    Response
        The health check
    """
    return Response(status_code=200)


# mount frontend static files
app.mount(
    "/frontend",
    StaticFiles(directory=FRONTEND_DIR),
    name="frontend",
)


# pylint: disable=unused-argument
@app.get("/{full_path:path}", include_in_schema=False)
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
