"""Configuration module for Waldiez Studio."""

import os
from typing import Any, List, Optional

from pydantic import ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from .lib import (
    ENV_PREFIX,
    get_default_domain_name,
    get_default_host,
    get_default_port,
    get_trusted_hosts,
    get_trusted_origins,
)
from .logging import get_logging_config


class Settings(BaseSettings):
    """Settings class."""

    host: str = get_default_host()
    port: int = get_default_port()
    domain_name: str = get_default_domain_name()
    force_ssl: bool = False
    trusted_hosts: str | List[str] = get_trusted_hosts(
        domain_name=domain_name, host=host
    )
    trusted_origins: str | List[str] = get_trusted_origins(
        domain_name=domain_name,
        port=port,
        force_ssl=force_ssl,
        host=host,
    )
    trusted_origin_regex: Optional[str] = None

    model_config = SettingsConfigDict(
        env_prefix=ENV_PREFIX,
        case_sensitive=False,
        extra="ignore",
        cli_parse_args=True,
        cli_ignore_unknown_args=True,
        cli_prefix="",
    )

    def to_env(self) -> None:
        """Set the environment variables."""
        for key, value in self.dict().items():
            if value:
                env_key = f"{ENV_PREFIX}{key.upper()}"
                env_value = (
                    str(value)
                    if not isinstance(value, list)
                    else ",".join(value)
                )
                os.environ[env_key] = env_value

    # pylint: disable=unused-argument
    @field_validator("trusted_hosts", "trusted_origins", mode="before")
    @classmethod
    def split_value(cls, value: Any, info: ValidationInfo) -> List[str]:
        """Split the value if it is a string.

        Parameters
        ----------
        value : Any
            The value
        info : ValidationInfo
            The validation info

        Returns
        -------
        List[str]
            The value as a list
        """
        if isinstance(value, str):
            if value.count(",") >= 1:
                return value.split(",")

            return [value]
        return value


__all__ = ["get_logging_config", "Settings"]
