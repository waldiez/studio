"""Start the application."""

import logging
import logging.config
import os
import sys
from pathlib import Path

import uvicorn
import uvicorn.config

try:
    from dotenv import load_dotenv
except ImportError:
    pass
else:
    load_dotenv()

try:
    from waldiez_studio.cli import get_parser, set_env_vars_from_args
except ImportError:
    sys.path.append(str(Path(__file__).parent.parent))
    from waldiez_studio.cli import get_parser, set_env_vars_from_args

from waldiez_studio.config import Settings, get_logging_config


def main() -> None:
    """Start the application."""
    args, _ = get_parser().parse_known_args()
    set_env_vars_from_args(args)
    logger = logging.getLogger("waldiez::studio")
    log_level = args.log_level.upper()
    if log_level != "DEBUG" and "--debug" in sys.argv:
        log_level = "DEBUG"
        sys.argv.remove("--debug")
    if log_level not in (
        "CRITICAL",
        "FATAL",
        "ERROR",
        "WARNING",
        "INFO",
        "DEBUG",
        "NOTSET",
    ):
        log_level = "INFO"
    logger.setLevel(log_level)
    print(f"Log level: {log_level}")
    this_dir = Path(__file__).parent
    app_module_path = f"{this_dir.name}.main"
    chdir_to = str(this_dir.parent)
    watch_dir = chdir_to
    if os.getcwd() != chdir_to:
        os.chdir(chdir_to)
    do_reload = args.reload is True or "--reload" in sys.argv
    logging_config = get_logging_config(log_level)
    logging.config.dictConfig(logging_config)
    logger.debug("Starting the application")
    settings = Settings()
    logger.debug("Settings: %s", settings.model_dump_json(indent=2))
    settings.to_env()
    uvicorn.run(
        f"{app_module_path}:app",
        host=args.host,
        port=args.port,
        reload=do_reload,
        app_dir=chdir_to,
        date_header=False,
        server_header=False,
        reload_dirs=[str(watch_dir)] if do_reload else None,
        reload_includes=["*.py"] if do_reload else None,
        reload_excludes=(
            [".*", ".py[cod]", ".sw.*", "~*"] if do_reload else None
        ),
        log_level=log_level.lower(),
        log_config=logging_config,
        proxy_headers=True,
        forwarded_allow_ips="*",
        ws_ping_timeout=None,
    )


if __name__ == "__main__":
    main()
