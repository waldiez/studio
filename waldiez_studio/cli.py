"""Command line interface module."""

import argparse
import os
import sys

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


def get_parser() -> argparse.ArgumentParser:
    """Parse the command line arguments.

    Returns
    -------
    argparse.ArgumentParser
        The command line arguments parser
    """
    parser = argparse.ArgumentParser(description="Waldiez Studio")
    parser.add_argument(
        "--host",
        type=str,
        default=DEFAULT_HOST,
        help="The host to listen on",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help="The port to listen on",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default=DEFAULT_LOG_LEVEL,
        choices=[
            "CRITICAL",
            "FATAL",
            "ERROR",
            "WARNING",
            "INFO",
            "DEBUG",
            "NOTSET",
        ],
        help="The log level",
    )
    parser.add_argument(
        "--domain-name",
        type=str,
        default=DEFAULT_DOMAIN_NAME,
        help="The domain name",
    )
    parser.add_argument(
        "--trusted-hosts",
        nargs="*",
        help="List of trusted hosts",
    )
    parser.add_argument(
        "--trusted-origins",
        nargs="*",
        help="List of trusted origins",
    )
    return parser


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
    if "--app-host" in sys.argv:
        host_arg = args.host
        os.environ["WALDIEZ_STUDIO_HOST"] = host_arg
    if "--app-port" in sys.argv:
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
