"""Command line interface module."""

# pylint: disable=missing-param-doc,missing-return-doc,missing-raises-doc
import logging
import logging.config
import os
import sys
from enum import Enum
from pathlib import Path
from typing import List

import typer
import uvicorn
import uvicorn.config

try:
    from dotenv import load_dotenv
except ImportError:
    pass
else:
    load_dotenv()

try:
    from waldiez_studio._version import __version__
except ImportError:
    sys.path.append(str(Path(__file__).parent))
    from waldiez_studio._version import __version__

from waldiez_studio._logging import get_logging_config
from waldiez_studio.config import (
    Settings,
    get_default_domain_name,
    get_default_host,
    get_default_port,
)


class LogLevel(str, Enum):
    """Log level enum."""

    CRITICAL = "CRITICAL"
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"
    DEBUG = "DEBUG"


DEFAULT_LOG_LEVEL = os.environ.get("WALDIEZ_STUDIO_LOG_LEVEL", "INFO")
LOG_LEVELS = {level.value for level in LogLevel}
if DEFAULT_LOG_LEVEL not in LOG_LEVELS:
    DEFAULT_LOG_LEVEL = "INFO"


app = typer.Typer(
    name="waldiez-studio",
    help="Waldiez Studio",
    context_settings={
        "allow_extra_args": True,
        "ignore_unknown_options": True,
    },
    add_completion=False,
    no_args_is_help=False,
    invoke_without_command=True,
    add_help_option=True,
    pretty_exceptions_short=False,
)


# pylint: disable=too-many-locals,unused-argument
@app.command()
def run(
    host: str = typer.Option(
        default=get_default_host(),
        help="The host to run the server on",
    ),
    port: int = typer.Option(
        default=get_default_port(),
        help="The port to run the server on",
    ),
    reload: bool = typer.Option(
        default=False,
        help="Reload the server on file changes",
    ),
    log_level: LogLevel = typer.Option(
        default=DEFAULT_LOG_LEVEL,
        help="The log level",
        case_sensitive=False,
    ),
    domain_name: str = get_default_domain_name(),
    trusted_hosts: List[str] = typer.Option(
        default_factory=list,
    ),
    trusted_origins: List[str] = typer.Option(
        default_factory=list,
    ),
    force_ssl: bool = typer.Option(
        default=False,
        help="Force SSL",
    ),
    version: bool = typer.Option(
        False,
        "--version",
        help="Show the version",
    ),
) -> None:
    """Get the command line arguments."""
    if version:
        typer.echo(f"Waldiez Studio {__version__}")
        raise typer.Exit()
    logging_config = get_logging_config(log_level.value.upper())
    logging.config.dictConfig(logging_config)
    logger = logging.getLogger("waldiez::studio")
    logger.debug("Starting the application")
    settings = Settings()
    logger.debug("Settings: %s", settings.model_dump_json(indent=2))
    settings.to_env()
    this_dir = Path(__file__).parent
    this_dir_name = this_dir.name
    chdir_to = str(this_dir.parent)
    if os.getcwd() != chdir_to:
        os.chdir(chdir_to)
    app_module_path = f"{this_dir_name}.main"
    uvicorn.run(
        f"{app_module_path}:app",
        host=host,
        port=port,
        reload=reload,
        app_dir=chdir_to,
        date_header=False,
        server_header=False,
        reload_dirs=[str(this_dir)],
        reload_excludes=(
            [
                "**/waldiez_out/**/*",
                ".*",
                ".py[cod]",
                ".sw.*",
                "~*",
                "**/files/**/*",
                ".venv/*",
            ]
            if reload
            else None
        ),
        log_level=log_level.lower(),
        log_config=logging_config,
        proxy_headers=True,
        forwarded_allow_ips="*",
        ws_ping_timeout=None,
    )


if __name__ == "__main__":
    app()
