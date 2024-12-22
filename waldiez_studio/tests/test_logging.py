"""Tests for the logging configuration."""

# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,missing-yield-doc,missing-param-doc,missing-raises-doc,line-too-long

from typing import Any, Dict
from unittest.mock import patch

import pytest

from waldiez_studio._logging import get_logging_config


@pytest.fixture(name="mock_logging_config")
def mock_logging_config_fixture() -> Dict[str, Any]:
    """Fixture to mock the uvicorn logging configuration."""
    return {
        "formatters": {"default": {"fmt": "%(message)s"}},
        "loggers": {
            "uvicorn": {"level": "DEBUG", "handlers": []},
            "uvicorn.error": {"level": "DEBUG", "handlers": []},
            "uvicorn.access": {"level": "DEBUG", "handlers": []},
        },
    }


def test_get_logging_config(mock_logging_config: Dict[str, Any]) -> None:
    """Test the get_logging_config function."""
    with patch("uvicorn.config.LOGGING_CONFIG", mock_logging_config):
        log_level = "WARNING"
        config = get_logging_config(log_level)
        assert (
            config["formatters"]["default"]["fmt"]
            == "%(levelprefix)s [%(name)s:%(filename)s:%(lineno)d] %(message)s"
        )
        assert config["loggers"]["uvicorn"]["level"] == log_level
        assert config["loggers"]["uvicorn.error"]["level"] == log_level
        assert config["loggers"]["uvicorn.access"]["level"] == log_level
        assert "httpx" in config["loggers"]
        httpx_logger = config["loggers"]["httpx"]
        assert httpx_logger["handlers"] == ["default"]
        assert httpx_logger["level"] == "INFO"
        assert "httpcore" in config["loggers"]
        httpcore_logger = config["loggers"]["httpcore"]
        assert httpcore_logger["handlers"] == ["default"]
        assert httpcore_logger["level"] == "INFO"
        for module in [
            "watchgod",
            "watchfiles",
            "httpcore",
            "httpx",
        ]:
            assert module in config["loggers"]
            module_logger = config["loggers"][module]
            assert module_logger["level"] == "INFO"
            assert module_logger["handlers"] == ["default"]
            assert module_logger["propagate"] is False

        root_logger = config["loggers"][""]
        assert root_logger["level"] == log_level
        assert root_logger["handlers"] == ["default"]
        assert root_logger["propagate"] is False
