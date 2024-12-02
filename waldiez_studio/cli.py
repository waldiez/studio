"""Command line interface module."""

# pylint: disable=missing-param-doc,missing-return-doc,missing-raises-doc

import argparse
import logging
import logging.config
import os
import sys
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
    from waldiez_studio.config import Settings, get_logging_config
except ImportError:
    sys.path.append(str(Path(__file__).parent))
    from waldiez_studio.config import Settings, get_logging_config

from waldiez_studio._version import __version__

DEFAULT_HOST = os.environ.get("WALDIEZ_STUDIO_HOST", "localhost")
_DEFAULT_PORT = os.environ.get("WALDIEZ_STUDIO_PORT", "8000")
try:
    DEFAULT_PORT = int(_DEFAULT_PORT)
except ValueError:
    DEFAULT_PORT = 8000

_DEFAULT_DOMAIN_NAME = os.environ.get("WALDIEZ_STUDIO_DOMAIN_NAME", "localhost")
DEFAULT_DOMAIN_NAME = _DEFAULT_DOMAIN_NAME
if "--domain-name" in sys.argv:
    domain_name_index = sys.argv.index("--domain-name") + 1
    if domain_name_index < len(sys.argv):
        domain_name_arg = sys.argv[domain_name_index]
        if domain_name_arg:
            os.environ["WALDIEZ_STUDIO_DOMAIN_NAME"] = domain_name_arg
            DEFAULT_DOMAIN_NAME = domain_name_arg
else:
    DEFAULT_DOMAIN_NAME = _DEFAULT_DOMAIN_NAME

_DEFAULT_LOG_LEVEL = os.environ.get("WALDIEZ_STUDIO_LOG_LEVEL", "INFO")
if _DEFAULT_LOG_LEVEL not in (
    "CRITICAL",
    "FATAL",
    "ERROR",
    "WARNING",
    "INFO",
    "DEBUG",
    "NOTSET",
):
    _DEFAULT_LOG_LEVEL = "INFO"

if "--debug" in sys.argv:
    DEFAULT_LOG_LEVEL = "DEBUG"
    sys.argv.remove("--debug")
else:
    DEFAULT_LOG_LEVEL = _DEFAULT_LOG_LEVEL


cli_app = typer.Typer(
    name="waldiez-studio",
    help="Waldiez Studio",
    add_completion=False,
    context_settings={"allow_extra_args": True},
    no_args_is_help=True,
    invoke_without_command=True,
    add_help_option=True,
    pretty_exceptions_short=False,
)


# pylint: disable=too-many-locals
@cli_app.command()
def run(
    host: str = typer.Option(
        default=DEFAULT_HOST,
        help="The host to run the server on",
    ),
    port: int = typer.Option(
        default=DEFAULT_PORT,
        help="The port to run the server on",
    ),
    reload: bool = typer.Option(
        default=False,
        help="Reload the server on file changes",
    ),
    log_level: str = typer.Option(
        default=DEFAULT_LOG_LEVEL,
        help="The log level",
    ),
    domain_name: str = DEFAULT_DOMAIN_NAME,
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
    ns = argparse.Namespace(
        host=host,
        port=port,
        reload=reload,
        log_level=log_level,
        domain_name=domain_name,
        trusted_hosts=trusted_hosts,
        trusted_origins=trusted_origins,
        force_ssl=force_ssl,
    )
    set_env_vars_from_args(ns)
    logging_config = get_logging_config(log_level)
    logging.config.dictConfig(logging_config)
    logger = logging.getLogger("waldiez::studio")
    logger.debug("Starting the application")
    settings = Settings()
    logger.debug("Settings: %s", settings.model_dump_json(indent=2))
    settings.to_env()
    this_dir = Path(__file__).parent
    chdir_to = str(this_dir.parent)
    if os.getcwd() != chdir_to:
        os.chdir(chdir_to)
    app_module_path = f"{this_dir.name}.main"
    uvicorn.run(
        f"{app_module_path}:app",
        host=host,
        port=port,
        reload=reload,
        app_dir=chdir_to,
        date_header=False,
        server_header=False,
        reload_dirs=[str(chdir_to)] if reload else None,
        reload_includes=["*.py"] if reload else None,
        reload_excludes=([".*", ".py[cod]", ".sw.*", "~*"] if reload else None),
        log_level=log_level.lower(),
        log_config=logging_config,
        proxy_headers=True,
        forwarded_allow_ips="*",
        ws_ping_timeout=None,
    )


def set_env_vars_from_args(args: argparse.Namespace) -> None:
    """Set the environment variables from the command line arguments.

    Parameters
    ----------
    args : argparse.Namespace
        The command line arguments

    """
    # check if --{arg} is in sys.argv to set
    # the corresponding environment variable
    # to skip using the default values
    if "--host" in sys.argv:
        host_arg = args.host
        os.environ["WALDIEZ_STUDIO_HOST"] = host_arg
    if "--port" in sys.argv:
        port_arg = args.port
        os.environ["WALDIEZ_STUDIO_PORT"] = str(port_arg)
    if "--domain-name" in sys.argv:
        domain_name = args.domain_name
        os.environ["WALDIEZ_STUDIO_DOMAIN_NAME"] = domain_name
    if "--trusted-hosts" in sys.argv:
        trusted_hosts = args.trusted_hosts
        os.environ["WALDIEZ_STUDIO_TRUSTED_HOSTS"] = ",".join(trusted_hosts)
    if "--trusted-origins" in sys.argv:
        trusted_origins = args.trusted_origins
        os.environ["WALDIEZ_STUDIO_TRUSTED_ORIGINS"] = ",".join(trusted_origins)
    if "--force-ssl" in sys.argv:
        force_ssl = args.force_ssl
        os.environ["WALDIEZ_STUDIO_FORCE_SSL"] = str(force_ssl)
    if "--log-level" in sys.argv:
        log_level = args.log_level
        os.environ["WALDIEZ_STUDIO_LOG_LEVEL"] = log_level
    if "--debug" in sys.argv:
        os.environ["WALDIEZ_STUDIO_LOG_LEVEL"] = "DEBUG"
        sys.argv.remove("--debug")


if __name__ == "__main__":
    cli_app()
