# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2026 Waldiez and contributors.

"""Tests for waldiez_studio.routes.common."""
# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,missing-param-doc,line-too-long

import os
from pathlib import Path

import pytest

from waldiez_studio.routes.common import (
    get_new_file_name,
    get_new_folder_name,
    sanitize_path,
)


@pytest.fixture(name="root_dir")
def root_dir_fixture(tmp_path: Path) -> Path:
    """Fixture to provide a temporary root directory."""
    return tmp_path


def test_get_new_folder_name_no_conflict(root_dir: Path) -> None:
    """Test get_new_folder_name with no conflicting folders."""
    folder_name = "test_folder"
    new_folder_name = get_new_folder_name(root_dir, folder_name)
    assert new_folder_name == folder_name


def test_get_new_folder_name_with_conflicts(root_dir: Path) -> None:
    """Test get_new_folder_name with existing conflicting folders."""
    folder_name = "test_folder"
    (root_dir / folder_name).mkdir()
    (root_dir / f"{folder_name} (1)").mkdir()
    new_folder_name = get_new_folder_name(root_dir, folder_name)
    assert new_folder_name == f"{folder_name} (2)"


def test_get_new_file_name_no_conflict(root_dir: Path) -> None:
    """Test get_new_file_name with no conflicting files."""
    file_name = "test_file.txt"
    new_file_name = get_new_file_name(root_dir, file_name)
    assert new_file_name == file_name


def test_get_new_file_name_with_conflicts(root_dir: Path) -> None:
    """Test get_new_file_name with existing conflicting files."""
    file_name = "test_file.txt"
    (root_dir / file_name).touch()
    (root_dir / "test_file (1).txt").touch()
    new_file_name = get_new_file_name(root_dir, file_name)
    assert new_file_name == "test_file (2).txt"


def test_get_new_file_name_no_extension(root_dir: Path) -> None:
    """Test get_new_file_name with a file that has no extension."""
    file_name = "test_file"
    (root_dir / file_name).touch()
    new_file_name = get_new_file_name(root_dir, file_name)
    assert new_file_name == "test_file (1)"


def test_sanitize_path_valid_path(root_dir: Path) -> None:
    """Test sanitize_path with a valid path."""
    valid_path = f"subdir{os.path.sep}file.txt"
    (root_dir / "subdir").mkdir()
    (root_dir / "subdir" / "file.txt").touch()
    sanitized = sanitize_path(root_dir, valid_path)
    assert sanitized == root_dir / valid_path
    if (root_dir / "subdir" / "file.txt").exists():
        (root_dir / "subdir" / "file.txt").unlink()
    (root_dir / "subdir").rmdir()


def test_sanitize_path_root(root_dir: Path) -> None:
    """Test sanitize_path with the root path."""
    sanitized = sanitize_path(root_dir, "/")
    assert sanitized == root_dir


def test_sanitize_unresolved_path(root_dir: Path) -> None:
    """Test sanitize_path with an unresolved path."""
    unresolved_path = f"subdir4{os.path.sep}file.txt"
    (root_dir / "subdir4").mkdir(exist_ok=True)
    (root_dir / "subdir4" / "file.txt").unlink(missing_ok=True)
    # noinspection PyTypeChecker
    with pytest.raises(
        (ValueError, FileNotFoundError), match="Error: Path not resolved"
    ):
        sanitize_path(root_dir, unresolved_path, True)


def test_sanitize_path_invalid_characters(root_dir: Path) -> None:
    """Test sanitize_path with a path containing invalid characters."""
    invalid_path = "subdir/<file>.txt"
    with pytest.raises(ValueError, match="Error: Invalid path"):
        sanitize_path(root_dir, invalid_path)


def test_sanitize_path_outside_root(root_dir: Path) -> None:
    """Test sanitize_path with a path that traverses outside the root directory."""
    invalid_path = "../outside_root/file.txt"
    with pytest.raises(ValueError, match="Error: Invalid path"):
        sanitize_path(root_dir, invalid_path)


def test_sanitize_path_double_dot(root_dir: Path) -> None:
    """Test sanitize_path with double dots that stay inside root."""
    valid_path = "subdir/../subdir2/file.txt"
    (root_dir / "subdir").mkdir()
    (root_dir / "subdir2").mkdir(parents=True)
    (root_dir / "subdir2" / "file.txt").touch()
    sanitized = sanitize_path(root_dir, valid_path)
    expected_path = (root_dir / "subdir2/file.txt").resolve()
    assert sanitized == expected_path


def test_sanitize_path_unicode_error(root_dir: Path) -> None:
    """Test sanitize_path with an invalid Unicode path."""
    invalid_path = b"%E0%A4%A".decode("utf-8", errors="ignore")
    with pytest.raises(ValueError, match="Error: Invalid path"):
        result = sanitize_path(root_dir, invalid_path)
        print(result)


def test_sanitize_path_decoded_root(root_dir: Path) -> None:
    """Test sanitize_path with a path that decodes to root ('/') after unquoting."""
    path = "%2F"  # Decodes to '/'
    sanitized = sanitize_path(root_dir, path)
    assert sanitized == root_dir


def test_sanitize_path_decoded_empty(root_dir: Path) -> None:
    """Test sanitize_path with a path that decodes to an empty string after unquoting."""
    path = "%20"  # Decodes to an empty string
    sanitized = sanitize_path(root_dir, path)
    assert sanitized == root_dir
