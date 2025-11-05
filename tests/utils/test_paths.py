# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Tests for waldiez_studio.utils.paths."""
# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,missing-param-doc,missing-yield-doc,unused-argument

import getpass
import os
from collections.abc import Generator
from pathlib import Path

import pytest

from waldiez_studio.utils.paths import get_root_dir, id_to_path, path_to_id


@pytest.fixture(name="base_dir")
def root_dir_fixture(tmp_path: Path) -> Generator[Path, None, None]:
    """Fixture to provide a temporary root directory."""
    current = os.environ.get("WALDIEZ_STUDIO_ROOT_DIR", "")
    os.environ["WALDIEZ_STUDIO_ROOT_DIR"] = str(tmp_path)
    yield tmp_path
    if current:
        os.environ["WALDIEZ_STUDIO_ROOT_DIR"] = current
    else:
        del os.environ["WALDIEZ_STUDIO_ROOT_DIR"]


def test_get_root_dir_default(base_dir: Path) -> None:
    """Test the get_root_dir function with default user_id."""
    root_dir = get_root_dir()
    assert isinstance(root_dir, Path)
    assert root_dir.exists()
    assert root_dir.name == getpass.getuser()
    root_dir.rmdir()


def test_get_root_dir_with_user_id(base_dir: Path) -> None:
    """Test the get_root_dir function with a specific user_id."""
    user_id = "user123"
    root_dir = get_root_dir(user_id)
    assert isinstance(root_dir, Path)
    assert root_dir.exists()
    assert root_dir.name == user_id
    root_dir.rmdir()


def test_path_to_id_and_back() -> None:
    """Test round-trip conversion of a Path to ID and back."""
    path = Path("/home/user/data/file.txt")
    path_id = path_to_id(path)
    reconstructed_path = id_to_path(path_id)

    assert isinstance(path_id, str), "Encoded ID should be a string."
    error = "Reconstructed Path should match the original."
    assert reconstructed_path == path, error


def test_different_paths_generate_different_ids() -> None:
    """Test that different paths produce different IDs."""
    path1 = Path("/home/user/data/file1.txt")
    path2 = Path("/home/user/data/file2.txt")

    id1 = path_to_id(path1)
    id2 = path_to_id(path2)

    assert id1 != id2, "Different paths should produce different IDs."


def test_same_paths_generate_same_id() -> None:
    """Test that the same path always produces the same ID."""
    path1 = Path("/home/user/data/file.txt")
    path2 = Path("/home/user/data/file.txt")

    id1 = path_to_id(path1)
    id2 = path_to_id(path2)

    assert id1 == id2, "The same path should produce the same ID."


def test_empty_path() -> None:
    """Test encoding and decoding an empty Path."""
    path = Path("")
    path_id = path_to_id(path)
    reconstructed_path = id_to_path(path_id)

    error = "Reconstructed Path should match the empty Path."
    assert reconstructed_path == path, error


def test_path_with_special_characters() -> None:
    """Test a Path with special characters."""
    path = Path("/home/user/data/file with spaces & symbols!@#.txt")
    path_id = path_to_id(path)
    reconstructed_path = id_to_path(path_id)

    error = (
        "Reconstructed Path should match the original with special characters."
    )
    assert reconstructed_path == path, error


def test_path_with_unicode_characters() -> None:
    """Test a Path with Unicode characters."""
    # cspell: disable-next-line
    path = Path("/home/user/データ/フκαι κάτι ακόμα.txt")
    path_id = path_to_id(path)
    reconstructed_path = id_to_path(path_id)

    error = "Reconstructed Path should match the original Unicode path."
    assert reconstructed_path == path, error


def test_invalid_base64_input() -> None:
    """Test decoding an invalid Base64 string."""
    invalid_id = "this_is_not_base64"

    with pytest.raises(Exception):
        _ = id_to_path(invalid_id)


def test_trailing_padding() -> None:
    """Test that missing Base64 padding does not break decoding."""
    path = Path("/home/user/data/file.txt")
    path_id = path_to_id(path)

    # Simulate missing padding by stripping '='
    padded_id = path_id.rstrip("=")

    # Ensure decoding works with missing padding
    reconstructed_path = id_to_path(padded_id)
    error = "Reconstructed Path should match even with stripped padding."
    assert reconstructed_path == path, error
