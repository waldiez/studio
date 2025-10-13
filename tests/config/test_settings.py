# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Test waldiez_studio.config.settings."""

# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,missing-yield-doc,missing-param-doc,missing-raises-doc,line-too-long
import os
import sys
from collections.abc import Generator
from pathlib import Path

import pytest

from waldiez_studio.config.lib import ENV_PREFIX
from waldiez_studio.config.settings import Settings

ROOT_DIR = Path(__file__).parent.parent.parent


@pytest.fixture(autouse=True)
def clear_env_and_args() -> Generator[None, None, None]:
    """Clear all related environment variables and reset command-line arguments before each test."""
    # Backup the current environment and arguments
    original_env = os.environ.copy()
    original_argv = sys.argv[:]

    # Clear all environment variables with the specified prefix
    related_env_vars = [key for key in os.environ if key.startswith(ENV_PREFIX)]
    for var in related_env_vars:
        del os.environ[var]

    # Reset `sys.argv` to default
    sys.argv = ["test_settings.py"]

    yield

    # Restore the original environment and arguments after the test
    os.environ.clear()
    os.environ.update(original_env)
    sys.argv = original_argv


def test_default_settings() -> None:
    """Test default settings values."""
    settings = Settings()
    assert settings.host == "localhost"
    assert settings.port == 8000
    assert settings.domain_name == "localhost"
    assert settings.force_ssl is False
    assert settings.trusted_hosts == ["localhost"]
    expected_origins = [
        "https://localhost",
        "http://localhost",
        "http://localhost:8000",
    ]
    assert settings.trusted_origins == expected_origins
    assert settings.trusted_origin_regex is None


def test_settings_with_env_vars() -> None:
    """Test settings loaded from environment variables."""
    os.environ[f"{ENV_PREFIX}HOST"] = "env-host"
    os.environ[f"{ENV_PREFIX}PORT"] = "9090"
    os.environ[f"{ENV_PREFIX}DOMAIN_NAME"] = "env-domain.com"
    os.environ[f"{ENV_PREFIX}FORCE_SSL"] = "true"
    os.environ[f"{ENV_PREFIX}TRUSTED_HOSTS"] = "host1,host2"
    os.environ[f"{ENV_PREFIX}TRUSTED_ORIGINS"] = (
        "https://origin1,http://origin2"
    )
    os.environ[f"{ENV_PREFIX}TRUSTED_ORIGIN_REGEX"] = "^https://.*"

    settings = Settings()

    assert settings.host == "env-host"
    assert settings.port == 9090
    assert settings.domain_name == "env-domain.com"
    assert settings.force_ssl is True
    assert settings.trusted_hosts == ["host1", "host2"]
    assert settings.trusted_origins == ["https://origin1", "http://origin2"]
    assert settings.trusted_origin_regex == "^https://.*"


def test_settings_with_cli_args() -> None:
    """Test settings loaded from CLI arguments."""
    # noinspection HttpUrlsUsage
    sys.argv.extend(
        [
            "--host",
            "cli-host",
            "--port",
            "8081",
            "--domain-name",
            "cli-domain.com",
            "--force-ssl",
            "--trusted-hosts",
            "cli-host1,cli-host2",
            "--trusted-origins",
            "https://cli-origin1,http://cli-origin2",
            "--trusted-origin-regex",
            "^http://.*",
        ]
    )
    settings = Settings()

    assert settings.host == "cli-host"
    assert settings.port == 8081
    assert settings.domain_name == "cli-domain.com"
    assert settings.force_ssl is True
    assert settings.trusted_hosts == ["cli-host1", "cli-host2"]
    assert settings.trusted_origins == [
        "https://cli-origin1",
        "http://cli-origin2",
    ]
    # noinspection HttpUrlsUsage
    assert settings.trusted_origin_regex == "^http://.*"


def test_to_env() -> None:
    """Test the to_env method."""
    settings = Settings(
        host="test-host",
        port=1234,
        domain_name="test-domain.com",
        trusted_hosts=["host1", "host2"],
        trusted_origins=["https://origin1", "http://origin2"],
        trusted_origin_regex="^https://.*",
    )

    settings.to_env()

    assert os.environ[f"{ENV_PREFIX}HOST"] == "test-host"
    assert os.environ[f"{ENV_PREFIX}PORT"] == "1234"
    assert os.environ[f"{ENV_PREFIX}DOMAIN_NAME"] == "test-domain.com"
    assert os.environ[f"{ENV_PREFIX}TRUSTED_HOSTS"] == "host1,host2"
    assert (
        os.environ[f"{ENV_PREFIX}TRUSTED_ORIGINS"]
        == "https://origin1,http://origin2"
    )
    assert os.environ[f"{ENV_PREFIX}TRUSTED_ORIGIN_REGEX"] == "^https://.*"


def test_split_value() -> None:
    """Test the split_value field validator."""
    settings = Settings(
        trusted_hosts="host1,host2",
        trusted_origins="https://origin1,http://origin2",
    )

    assert settings.trusted_hosts == ["host1", "host2"]
    assert settings.trusted_origins == ["https://origin1", "http://origin2"]


def test_split_value_single_value() -> None:
    """Test the split_value validator with a single value."""
    settings = Settings(
        trusted_hosts="single_host",
        trusted_origins="https://singleorigin",
    )

    assert settings.trusted_hosts == ["single_host"]
    assert settings.trusted_origins == ["https://singleorigin"]


def test_split_value_list() -> None:
    """Test the split_value validator with a pre-parsed list."""
    settings = Settings(
        trusted_hosts=["host1", "host2"],
        trusted_origins=["https://origin1", "http://origin2"],
    )

    assert settings.trusted_hosts == ["host1", "host2"]
    assert settings.trusted_origins == ["https://origin1", "http://origin2"]
