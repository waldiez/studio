"""Application entry point."""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from waldiez_studio.config import Settings
from waldiez_studio.extra_static_files import ensure_extra_static_files
from waldiez_studio.middleware import SecurityHeadersMiddleware
from waldiez_studio.routes import api_router

ROOT_DIR = Path(__file__).parent
STATIC_DIR = ROOT_DIR / "static"
MONACO_DIR = STATIC_DIR / "monaco"
MONACO_DIR.mkdir(parents=True, exist_ok=True)
MONACO_MIN_MAPS = MONACO_DIR / "min-maps"
MONACO_MIN_MAPS.mkdir(parents=True, exist_ok=True)

settings = Settings()


@asynccontextmanager
async def lifespan(
    _app: FastAPI,
) -> AsyncIterator[None]:
    """Application lifespan context manager.

    Yields
    ------
    None
        The application lifespan
    """
    # make sure we have downloaded the monaco editor files
    # they are not included in the package
    ensure_extra_static_files(STATIC_DIR / "monaco")
    yield


app = FastAPI(
    lifespan=lifespan,
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

# static files
app.mount(
    "/monaco", StaticFiles(directory=STATIC_DIR / "monaco"), name="monaco"
)
app.mount(
    "/min-maps",
    StaticFiles(directory=STATIC_DIR / "monaco" / "min-maps"),
    name="min-maps",
)

# include api routes
app.include_router(api_router, prefix="/api")


# common routes
@app.get("/robots.txt")
async def robots() -> Response:
    """Serve the robots.txt file.

    Returns
    -------
    Response
        The robots.txt file
    """
    return FileResponse(STATIC_DIR / "frontend" / "robots.txt")


@app.get("/favicon.ico")
async def favicon() -> Response:
    """Serve the favicon.

    Returns
    -------
    Response
        The favicon file

    """
    return FileResponse(STATIC_DIR / "frontend" / "favicon.ico")


@app.get("/health")
@app.get("/healthz")
async def healthz() -> Response:
    """Health check.

    Returns
    -------
    Response
        The health check
    """
    return Response(status_code=200)


# serve the frontend if no other route matches
app.mount(
    "/",
    StaticFiles(directory=STATIC_DIR / "frontend", html=True),
    name="frontend",
)


# catch all route
# pylint: disable=unused-argument
@app.get("/{path:path}", response_class=RedirectResponse)
async def catch_all(path: str) -> Response:
    """Catch all route.

    Parameters
    ----------
    path : str
        The requested path

    Returns
    -------
    Response
        Redirect to the root path
    """
    return RedirectResponse(url="/")
