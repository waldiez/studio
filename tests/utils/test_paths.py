"""Tests for waldiez_studio.utils.paths."""

# pylint: disable=missing-function-docstring,missing-return-doc,missing-param-doc,missing-yield-doc,unused-argument

import os
from pathlib import Path
from typing import Generator

import pytest

from waldiez_studio.utils.paths import get_root_dir


@pytest.fixture(name="base_dir")
def root_dir_fixture(tmp_path: Path) -> Generator[Path, None, None]:
    """Fixture to provide a temporary root directory."""
    os.environ["WALDIEZ_STUDIO_ROOT_DIR"] = str(tmp_path)
    yield tmp_path


def test_get_root_dir_default(base_dir: Path) -> None:
    """Test the get_root_dir function with default user_id."""
    root_dir = get_root_dir()
    assert isinstance(root_dir, Path)
    assert root_dir.exists()
    assert root_dir.name == "default"
    root_dir.rmdir()


def test_get_root_dir_with_user_id(base_dir: Path) -> None:
    """Test the get_root_dir function with a specific user_id."""
    user_id = "user123"
    root_dir = get_root_dir(user_id)
    assert isinstance(root_dir, Path)
    assert root_dir.exists()
    assert root_dir.name == user_id
    root_dir.rmdir()
