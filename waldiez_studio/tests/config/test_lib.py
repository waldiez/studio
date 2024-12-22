"""Test waldiez_studio.config.lib."""

# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,missing-yield-doc,missing-param-doc,missing-raises-doc,line-too-long

import os
import sys
from typing import Generator
from unittest.mock import patch

import pytest

from waldiez_studio.config.lib import (
    get_default_domain_name,
    get_default_host,
    get_default_port,
    get_trusted_hosts,
    get_trusted_origins,
)

ENV_PREFIX = "WALDIEZ_STUDIO_"


@pytest.fixture(autouse=True)
def clear_env_and_args() -> Generator[None, None, None]:
    """Clear environment variables and command-line arguments before each test."""
    env_vars = [
        f"{ENV_PREFIX}TRUSTED_HOSTS",
        f"{ENV_PREFIX}TRUSTED_ORIGINS",
        f"{ENV_PREFIX}DOMAIN_NAME",
        f"{ENV_PREFIX}HOST",
        f"{ENV_PREFIX}PORT",
    ]
    for var in env_vars:
        os.environ.pop(var, None)
    original_argv = sys.argv[:]
    sys.argv = ["test_lib.py"]
    yield
    sys.argv = original_argv


def test_get_trusted_hosts_no_env() -> None:
    """Test get_trusted_hosts with no environment variables."""
    domain_name = "example.com"
    host = "localhost"
    assert get_trusted_hosts(domain_name, host) == ["example.com"]


def test_get_trusted_hosts_with_env() -> None:
    """Test get_trusted_hosts with environment variables."""
    os.environ[f"{ENV_PREFIX}TRUSTED_HOSTS"] = "host1,host2"
    domain_name = "example.com"
    host = "localhost"
    assert get_trusted_hosts(domain_name, host) == [
        "host1",
        "host2",
        "example.com",
    ]


def test_get_trusted_hosts_with_cmd_args() -> None:
    """Test get_trusted_hosts with command-line arguments."""
    sys.argv += ["--trusted-hosts", "trustedhost"]
    domain_name = "example.com"
    host = "localhost"
    assert get_trusted_hosts(domain_name, host) == [
        "example.com",
        "trustedhost",
    ]


def test_get_trusted_origins_no_env() -> None:
    """Test get_trusted_origins with no environment variables."""
    domain_name = "example.com"
    port = 8000
    force_ssl = False
    host = "localhost"
    expected = [
        "https://example.com",
        "https://localhost",
        "http://example.com",
        "http://example.com:8000",
        "http://localhost",
        "http://localhost:8000",
    ]
    assert get_trusted_origins(domain_name, port, force_ssl, host) == expected


def test_get_trusted_origins_with_env() -> None:
    """Test get_trusted_origins with environment variables."""
    os.environ[f"{ENV_PREFIX}TRUSTED_ORIGINS"] = (
        "https://custom1,http://custom2"
    )
    domain_name = "example.com"
    port = 8000
    force_ssl = True
    host = "localhost"
    expected = [
        "https://custom1",
        "http://custom2",
        "https://example.com",
        "https://localhost",
    ]
    assert get_trusted_origins(domain_name, port, force_ssl, host) == expected


def test_get_trusted_origins_with_cmd_args() -> None:
    """Test get_trusted_origins with command-line arguments."""
    sys.argv += ["--trusted-origins", "https://cmd-origin"]
    domain_name = "example.com"
    port = 8000
    force_ssl = False
    host = "localhost"
    expected = [
        "https://example.com",
        "https://localhost",
        "http://example.com",
        "http://example.com:8000",
        "http://localhost",
        "http://localhost:8000",
        "https://cmd-origin",
    ]
    assert get_trusted_origins(domain_name, port, force_ssl, host) == expected


def test_get_default_domain_name() -> None:
    """Test get_default_domain_name with environment variable and command-line argument."""
    os.environ[f"{ENV_PREFIX}DOMAIN_NAME"] = "env-domain.com"
    assert get_default_domain_name() == "env-domain.com"

    sys.argv += ["--domain-name", "cmd-domain.com"]
    assert get_default_domain_name() == "cmd-domain.com"


def test_get_default_host() -> None:
    """Test get_default_host with environment variable and command-line argument."""
    os.environ[f"{ENV_PREFIX}HOST"] = "env-host"
    assert get_default_host() == "env-host"

    sys.argv += ["--host", "cmd-host"]
    assert get_default_host() == "cmd-host"


def test_get_default_port() -> None:
    """Test get_default_port with environment variable, command-line argument, and invalid inputs."""
    os.environ[f"{ENV_PREFIX}PORT"] = "8080"
    assert get_default_port() == 8080

    sys.argv += ["--port", "9090"]
    assert get_default_port() == 9090

    # Reset sys.argv to remove the command-line argument
    sys.argv = ["test_lib.py"]
    os.environ[f"{ENV_PREFIX}PORT"] = "invalid"
    assert get_default_port() == 8000

    sys.argv += ["--port", "invalid"]
    assert get_default_port() == 8000


def test_get_trusted_hosts_non_list_env() -> None:
    """Test get_trusted_hosts when environment variable is not a list."""
    with patch("os.environ.get", return_value="not_a_list"):
        domain_name = "example.com"
        host = "localhost"
        assert get_trusted_hosts(domain_name, host) == [
            "not_a_list",
            "example.com",
        ]


def test_get_trusted_hosts_custom_host() -> None:
    """Test get_trusted_hosts with a custom host not in the default trusted hosts."""
    domain_name = "example.com"
    host = "custom_host.com"
    assert get_trusted_hosts(domain_name, host) == [
        "example.com",
        "custom_host.com",
    ]
