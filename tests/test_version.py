# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Test waldiez_studio.version."""

from pathlib import Path

import waldiez_studio


def _read_version() -> str:
    """Read the version from the package."""
    version_py = Path(__file__).parent.parent / "waldiez_studio" / "_version.py"
    version = "0.0.0"
    with version_py.open() as f:
        for line in f:
            if line.startswith("__version__"):
                version = line.split()[-1].strip('"').strip("'")
                break
    return version


def test_version() -> None:
    """Test __version__."""
    from_file = _read_version()
    assert from_file != "0.0.0"
    assert waldiez_studio.__version__ == from_file
