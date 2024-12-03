"""ID generator module."""

import os

from snowflake import SnowflakeGenerator  # type: ignore[import-untyped]

_SNOWFLAKE_INSTANCE = os.environ.get("WALDIEZ_SNOWFLAKE_INSTANCE", "1")
try:
    WALDIEZ_SNOWFLAKE_INSTANCE = int(_SNOWFLAKE_INSTANCE)
except ValueError:
    WALDIEZ_SNOWFLAKE_INSTANCE = 1


_GENERATOR = SnowflakeGenerator(instance=WALDIEZ_SNOWFLAKE_INSTANCE)


def get_next_id() -> int:
    """Get the next ID.

    Returns
    -------
    int
        Next ID.
    """
    return next(_GENERATOR)
