# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Logging configuration module."""

import logging
from typing import TYPE_CHECKING, Any

import uvicorn.config

if TYPE_CHECKING:
    from waldiez_studio.config import Settings


# fmt: off
def get_logging_config(log_level: str) -> dict[str, Any]:
    """Get logging config dict.

    Parameters
    ----------
    log_level : str
        The log level

    Returns
    -------
    dict[str, Any]
        The logging config dict
    """
    # skip spamming logs from these modules
    modules_to_have_level_info = [
        "watchgod",
        "watchfiles",
        "httpcore",
        "httpx",
    ]
    logging_config = uvicorn.config.LOGGING_CONFIG
    logging_config["formatters"]["default"]["fmt"] = (
        "%(levelprefix)s [%(name)s:%(filename)s:%(lineno)d] %(message)s"
    )
    logging_config["loggers"]["uvicorn"]["level"] = log_level
    logging_config["loggers"]["uvicorn.error"]["level"] = log_level
    logging_config["loggers"]["uvicorn.access"]["level"] = log_level
    httpx_logger = logging_config["loggers"].get("httpx", {})
    logging_config["loggers"]["httpx"] = httpx_logger
    logging_config["loggers"]["httpx"]["level"] = log_level
    logging_config["loggers"]["httpx"]["handlers"] = ["default"]
    http_core_logger = logging_config["loggers"].get("httpcore", {})
    logging_config["loggers"]["httpcore"] = http_core_logger
    logging_config["loggers"]["httpcore"]["handlers"] = ["default"]
    logging_config["loggers"]["httpcore"]["level"] = log_level
    for module in modules_to_have_level_info:
        logging_config["loggers"][module] = {
            "handlers": ["default"],
            "level": "INFO",
            "propagate": False,
        }
    logging_config["loggers"][""] = {
        "handlers": ["default"],
        "level": log_level,
        "propagate": False,
    }
    return logging_config
# fmt: on


def patch_uvicorn_logging(settings: "Settings") -> None:
    """Patch uvicorn logging.

    Parameters
    ----------
    settings : Settings
        The settings to get the host/port/base_url
    """
    uvicorn_logger = logging.getLogger("uvicorn.error")
    orig_info = uvicorn_logger.info

    def _patched_info(msg: Any, *args: Any, **kwargs: Any) -> None:
        if "Uvicorn running on" in msg:
            host = (
                settings.host
                if settings.host not in ("127.0.0.1", "0.0.0.0")
                else "localhost"
            )
            port = f":{settings.port}"
            if settings.port in (80, 443):
                port = ""
            base_url = settings.get_base_url()
            running_on = f"http://{host}{port}{base_url}"
            msg = (
                f"Waldiez studio running on {running_on} (Press CTRL+C to quit)"
            )
            orig_info(msg)
        else:
            orig_info(msg, *args, **kwargs)

    uvicorn_logger.info = _patched_info  # type: ignore
