# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2026 Waldiez and contributors.

"""Tests for the CLI module."""

# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,missing-yield-doc,missing-param-doc,missing-raises-doc,line-too-long,unused-argument

import re
from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

from waldiez_studio.cli import app

runner = CliRunner()


def escape_ansi(text: str) -> str:
    """Remove ANSI escape sequences from a string.

    Parameters
    ----------
    text : str
        The text to process.

    Returns
    -------
    str
        The text without ANSI escape sequences.
    """
    ansi_escape = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")
    return ansi_escape.sub("", text)


@pytest.fixture(name="mock_uvicorn_run")
def mock_uvicorn_run_fixture() -> Generator[MagicMock, None, None]:
    """Fixture to mock uvicorn.run function."""
    with patch("waldiez_studio.cli.uvicorn.run") as mock_run:
        yield mock_run


@pytest.fixture(name="mock_get_logging_config")
def mock_get_logging_config_fixture() -> Generator[MagicMock, None, None]:
    """Fixture to mock get_logging_config function."""
    with patch(
        "waldiez_studio.cli.get_logging_config", return_value={"version": 1}
    ) as mock_config:
        yield mock_config


@pytest.fixture(name="mock_settings")
def mock_settings_fixture() -> Generator[MagicMock, None, None]:
    """Fixture to mock Settings object."""
    mock_settings = MagicMock()
    mock_settings.model_dump_json.return_value = "{}"
    mock_settings.to_env.return_value = None
    with patch(
        "waldiez_studio.cli.Settings", return_value=mock_settings
    ) as mock_cls:
        yield mock_cls


def test_cli_help() -> None:
    """Test the CLI help message."""
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    escaped_output = escape_ansi(result.output)
    assert "Usage" in escaped_output
    assert "--version" in escaped_output
    assert "run" in escaped_output


def test_cli_version() -> None:
    """Test the CLI version flag."""
    result = runner.invoke(app, ["--version"])
    assert result.exit_code == 0
    assert "Waldiez Studio" in escape_ansi(result.output)


def test_run_command_defaults(
    mock_uvicorn_run: MagicMock,
    mock_get_logging_config: MagicMock,
    mock_settings: MagicMock,
) -> None:
    """Test the `run` command with default options."""
    result = runner.invoke(app)
    assert result.exit_code == 0
    mock_uvicorn_run.assert_called_once()
    assert mock_uvicorn_run.call_args[1]["host"] in ("localhost", "0.0.0.0")
    assert mock_uvicorn_run.call_args[1]["port"] == 8000  # Default port


def test_run_command_custom_options(
    mock_uvicorn_run: MagicMock,
    mock_get_logging_config: MagicMock,
    mock_settings: MagicMock,
) -> None:
    """Test the `run` command with custom options."""
    result = runner.invoke(
        app,
        [
            "--host",
            "0.0.0.0",
            "--port",
            "8080",
            "--reload",
            "--log-level",
            "DEBUG",
            "--force-ssl",
        ],
    )
    assert result.exit_code == 0
    mock_uvicorn_run.assert_called_once()
    assert mock_uvicorn_run.call_args[1]["host"] == "0.0.0.0"
    assert mock_uvicorn_run.call_args[1]["port"] == 8080
    assert mock_uvicorn_run.call_args[1]["reload"] is True
    assert mock_uvicorn_run.call_args[1]["log_level"] == "debug"


def test_run_invalid_log_level(
    mock_uvicorn_run: MagicMock,
    mock_get_logging_config: MagicMock,
    mock_settings: MagicMock,
) -> None:
    """Test the `run` command with an invalid log level."""
    result = runner.invoke(app, ["--log-level", "INVALID"])
    assert result.exit_code != 0
    assert "Error" in result.output


def test_debug_flag(
    mock_uvicorn_run: MagicMock,
    mock_get_logging_config: MagicMock,
    mock_settings: MagicMock,
) -> None:
    """Test the --debug flag."""
    result = runner.invoke(app, ["--log-level", "DEBUG"])
    assert result.exit_code == 0
    assert mock_uvicorn_run.call_args[1]["log_level"] == "debug"
