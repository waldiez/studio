"""Logging configuration module."""

from typing import Any, Dict

import uvicorn.config


# fmt: off
def get_logging_config(log_level: str) -> Dict[str, Any]:
    """Get logging config dict.

    Parameters
    ----------
    log_level : str
        The log level

    Returns
    -------
    Dict[str, Any]
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
