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
                version = line.split()[-1].strip('"')
                break
    return version


def test_version() -> None:
    """Test __version__."""
    assert waldiez_studio.__version__ == _read_version()
