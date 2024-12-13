"""Waldiez Studio settings module."""

import os
from typing import Any, List, Optional, Tuple, Type

from pydantic import ValidationInfo, field_validator
from pydantic_settings import (
    BaseSettings,
    CliSettingsSource,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
)

from .lib import (
    ENV_PREFIX,
    get_default_domain_name,
    get_default_host,
    get_default_port,
    get_trusted_hosts,
    get_trusted_origins,
)


def to_kebab(value: str) -> str:
    """Convert a string to kebab case.

    Parameters
    ----------
    value : str
        The string to convert

    Returns
    -------
    str
        The converted string
    """
    return value.replace("_", "-")


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
        alias_generator=to_kebab,
        populate_by_name=True,
        env_prefix=ENV_PREFIX,
        case_sensitive=False,
        extra="ignore",
        cli_parse_args=True,
        cli_ignore_unknown_args=True,
        cli_implicit_flags=True,
        cli_prefix="",
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: Type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> Tuple[PydanticBaseSettingsSource, ...]:
        """Customize the sources.

        Parameters
        ----------
        settings_cls : Type[BaseSettings]
            The settings class
        init_settings : PydanticBaseSettingsSource
            The init settings
        env_settings : PydanticBaseSettingsSource
            The environment settings
        dotenv_settings : PydanticBaseSettingsSource
            The dotenv settings
        file_secret_settings : PydanticBaseSettingsSource
            The file secret settings
        Returns
        -------
        Tuple[PydanticBaseSettingsSource, ...]
            The sources to use priority-wise
        """
        return (
            CliSettingsSource(
                settings_cls,
                cli_implicit_flags=True,
                cli_ignore_unknown_args=True,
                cli_prefix="",
                cli_parse_args=True,
            ),
            env_settings,
            init_settings,
            dotenv_settings,
            file_secret_settings,
        )

    def to_env(self) -> None:
        """Set the environment variables."""
        for key, value in self.model_dump().items():
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


def get_settings() -> Settings:
    """Get the settings.

    Returns
    -------
    Settings
        The settings
    """
    settings = Settings()
    is_testing = os.environ.get("WALDIEZ_STUDIO_TESTING", "False") == "true"
    if is_testing:
        settings.trusted_hosts = ["test"]
        settings.trusted_origins = ["http://test"]
    return settings
