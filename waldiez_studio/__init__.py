"""Waldiez studio package."""

import logging
import warnings

from ._version import __version__  # noqa


# pylint: disable=too-few-public-methods
class FlamlFilter(logging.Filter):
    """Filter out flaml.automl is not available message."""

    def filter(self, record: logging.LogRecord) -> bool:
        """Filter out flaml.automl is not available message.

        Parameters
        ----------
        record : logging.LogRecord
            Log record to filter.

        Returns
        -------
        bool
            Whether to filter out the log record.
        """
        return "flaml.automl is not available" not in record.getMessage()


__HANDLED_FLAML_LOGGER = False

if not __HANDLED_FLAML_LOGGER:
    flam_logger = logging.getLogger("flaml")
    flam_logger.addFilter(FlamlFilter())
    warnings.filterwarnings("ignore", module="flaml")
    __HANDLED_FLAML_LOGGER = True


__all__ = ["__version__"]
