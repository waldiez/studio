# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Tests for the workspace routes."""
# flake8: noqa
# pylint: disable=missing-function-docstring,missing-return-doc,missing-yield-doc,missing-param-doc,missing-raises-doc,line-too-long

import io
import sqlite3
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from waldiez_studio.routes import common
from waldiez_studio.routes.workspace import api


@pytest.fixture(autouse=True, name="client")
async def get_client(tmp_path: Path) -> AsyncGenerator[AsyncClient, None]:
    app = FastAPI()

    def override_get_root_directory() -> Path:
        return tmp_path

    app.include_router(api)
    app.dependency_overrides = {
        common.get_root_directory: override_get_root_directory
    }
    # api_client = TestClient(app)
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as api_client:
        yield api_client


@pytest.mark.asyncio
async def test_list_items_empty_root(client: AsyncClient) -> None:
    response = await client.get("/workspace")
    assert response.status_code == 200
    assert response.json() == {"items": []}


@pytest.mark.asyncio
async def test_list_items_with_content(
    client: AsyncClient, tmp_path: Path
) -> None:
    test_dir = tmp_path / "test_folder"
    test_dir.mkdir()
    (test_dir / "file1.txt").write_text("Test file 1")
    (test_dir / "file2.txt").write_text("Test file 2")

    response = await client.get("/workspace", params={"parent": "test_folder"})
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 2
    assert all(item["type"] == "file" for item in items)


@pytest.mark.asyncio
async def test_create_folder(client: AsyncClient) -> None:
    """Test creating a new folder."""
    response = await client.post(
        "/workspace", json={"parent": None, "type": "folder"}
    )
    print(response.json())
    assert response.status_code == 200
    assert response.json()["type"] == "folder"


@pytest.mark.asyncio
async def test_create_file(client: AsyncClient) -> None:
    """Test creating a new file."""
    response = await client.post(
        "/workspace", json={"parent": None, "type": "file"}
    )
    print(response.json())
    assert response.status_code == 200
    assert response.json()["type"] == "file"


@pytest.mark.asyncio
async def test_rename_file_or_folder(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test renaming a file or folder."""
    test_dir = tmp_path / "test_folder"
    test_dir.mkdir()

    response = await client.post(
        "/workspace/rename",
        json={"old_path": "test_folder", "new_path": "renamed_folder"},
    )
    assert response.status_code == 200
    assert response.json()["path"] == "renamed_folder"


@pytest.mark.asyncio
async def test_upload_file(client: AsyncClient, tmp_path: Path) -> None:
    """Test uploading a file."""
    with open(tmp_path / "tmp_test_file.txt", "w", encoding="utf-8") as f:
        f.write("This is a test file.")

    with open(tmp_path / "tmp_test_file.txt", "rb") as f:
        response = await client.post(
            "/workspace/upload",
            data={"path": ""},
            files={"file": ("test_file.txt", f, "text/plain")},
        )

    assert response.status_code == 200
    uploaded_file = tmp_path / "test_file.txt"
    assert uploaded_file.exists()


@pytest.mark.asyncio
async def test_upload_file_in_subdir(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test uploading a file in subdir."""
    test_dir = tmp_path / "sub"
    test_dir.mkdir()
    with open(test_dir / "tmp_test_file1.txt", "w", encoding="utf-8") as f:
        f.write("This is a test file.")

    with open(test_dir / "tmp_test_file1.txt", "rb") as f:
        response = await client.post(
            "/workspace/upload",
            data={"path": "sub"},
            files={"file": ("test_file1.txt", f, "text/plain")},
        )

    assert response.status_code == 200
    uploaded_file = test_dir / "test_file1.txt"
    assert uploaded_file.exists()


@pytest.mark.asyncio
async def test_download_file(client: AsyncClient, tmp_path: Path) -> None:
    """Test downloading a file."""
    test_file = tmp_path / "test_file.txt"
    test_file.write_text("Download me!")

    response = await client.get(
        "/workspace/download", params={"path": "test_file.txt"}
    )
    assert response.status_code == 200
    assert response.content == b"Download me!"
    test_file.unlink()


@pytest.mark.asyncio
async def test_download_nonexistent_file(client: AsyncClient) -> None:
    """Test downloading a file that does not exist."""
    response = await client.get(
        "/workspace/download", params={"path": "nonexistent"}
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Error: Path not found"


@pytest.mark.asyncio
async def test_download_folder(client: AsyncClient, tmp_path: Path) -> None:
    """Test downloading a folder."""
    test_dir = tmp_path / "test_folder"
    test_dir.mkdir()
    (test_dir / "nested_file.txt").write_text("Nested content")

    response = await client.get(
        "/workspace/download", params={"path": "test_folder"}
    )
    assert response.status_code == 200
    assert response.headers["Content-Type"] in (
        "application/zip",
        "application/x-zip-compressed",
    )


@pytest.mark.asyncio
async def test_download_folder_error(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test downloading a folder when an error occurs."""
    test_dir = tmp_path / "test_folder"
    test_dir.mkdir()
    (test_dir / "nested_file.txt").write_text("Nested content")

    with patch("shutil.make_archive", side_effect=PermissionError):
        response = await client.get(
            "/workspace/download", params={"path": "test_folder"}
        )

    assert response.status_code == 500
    assert response.json()["detail"] == "Error: Failed to download folder"


@pytest.mark.asyncio
async def test_delete_file(client: AsyncClient, tmp_path: Path) -> None:
    """Test deleting a file."""
    test_file = tmp_path / "test_file.txt"
    test_file.write_text("Delete me!")
    response = await client.delete(
        "/workspace", params={"path": "test_file.txt"}
    )
    assert response.status_code == 200
    assert not test_file.exists()


@pytest.mark.asyncio
async def test_delete_folder(client: AsyncClient, tmp_path: Path) -> None:
    """Test deleting a folder."""
    test_dir = tmp_path / "test_folder"
    test_dir.mkdir()
    response = await client.delete("/workspace", params={"path": "test_folder"})
    assert response.status_code == 200
    assert not test_dir.exists()


@pytest.mark.asyncio
async def test_sanitize_invalid_path(client: AsyncClient) -> None:
    """Test handling of invalid paths in `_sanitize_path`."""
    response = await client.get(
        "/workspace", params={"parent": "../invalid/path"}
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Error: Directory not found"


@pytest.mark.asyncio
async def test_list_nonexistent_directory(client: AsyncClient) -> None:
    """Test listing a nonexistent directory."""
    response = await client.get("/workspace", params={"parent": "nonexistent"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Error: Directory not found"


@pytest.mark.asyncio
async def test_rename_nonexistent_source(client: AsyncClient) -> None:
    """Test renaming a file or folder that does not exist."""
    response = await client.post(
        "/workspace/rename",
        json={"old_path": "nonexistent", "new_path": "new_name"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Error: Path not found"


@pytest.mark.asyncio
async def test_rename_to_existing_target(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test renaming a file or folder to an existing target."""
    source = tmp_path / "source"
    target = tmp_path / "target"
    source.mkdir()
    target.mkdir()

    response = await client.post(
        "/workspace/rename",
        json={"old_path": "source", "new_path": "target"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Error: Directory already exists"


@pytest.mark.asyncio
async def test_upload_existing_file(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test uploading a file that already exists."""
    test_file = tmp_path / "test_file.txt"
    test_file.write_text("Existing file content")

    with open(tmp_path / "test_file.txt", "rb") as f:
        response = await client.post(
            "/workspace/upload",
            data={"path": ""},
            files={"file": ("test_file.txt", f, "text/plain")},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Error: File already exists"


@pytest.mark.asyncio
async def test_upload_file_exceeding_size(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test uploading a file that exceeds the maximum size."""
    large_file_dir = tmp_path / "tmp"
    large_file_dir.mkdir(parents=True)
    large_file_path = large_file_dir / "large_file.txt"
    with large_file_path.open("wb") as f:
        f.write(b"x" * (50 * 1024 * 1024 + 1))  # Exceed 50 MB

    with large_file_path.open("rb") as f:
        response = await client.post(
            "/workspace/upload",
            data={"path": ""},
            files={"file": ("large_file.txt", f, "text/plain")},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Error: File exceeds maximum size"
    large_file_path.unlink()


@pytest.mark.asyncio
async def test_delete_nonexistent_file(client: AsyncClient) -> None:
    """Test deleting a file that does not exist."""
    response = await client.delete(
        "/workspace", params={"path": "nonexistent_file"}
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Error: Path not found"


@pytest.mark.asyncio
async def test_delete_folder_with_contents(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test deleting a folder that contains files."""
    test_dir = tmp_path / "test_folder"
    test_dir.mkdir()
    (test_dir / "nested_file.txt").write_text("Nested content")

    response = await client.delete("/workspace", params={"path": "test_folder"})
    assert response.status_code == 200
    assert not test_dir.exists()


@pytest.mark.asyncio
async def test_sanitize_empty_path(client: AsyncClient) -> None:
    """Test sanitizing an empty path."""
    response = await client.get("/workspace", params={"parent": ""})
    assert response.status_code == 200
    assert response.json() == {"items": []}


@pytest.mark.asyncio
async def test_create_folder_in_invalid_location(client: AsyncClient) -> None:
    """Test creating a folder in an invalid location."""
    response = await client.post(
        "/workspace", json={"parent": "../invalid", "type": "folder"}
    )
    assert response.status_code in (400, 404)
    assert response.json()["detail"] in (
        "Error: Invalid path",
        "Error: Directory not found",
    )


@pytest.mark.asyncio
async def test_create_folder_with_permission_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Test creating a folder when a permission error occurs."""

    # noinspection PyUnusedLocal
    def mock_mkdir(*args: Any, **kwargs: Any) -> None:
        """Mock the `Path.mkdir` method to raise a permission error."""
        raise PermissionError("Mocked permission error")

    monkeypatch.setattr(Path, "mkdir", mock_mkdir)

    response = await client.post(
        "/workspace", json={"parent": None, "type": "folder"}
    )
    assert response.status_code == 500
    assert "Failed to create folder" in response.json()["detail"]


@pytest.mark.asyncio
async def test_rename_into_non_directory(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test renaming a folder into a non-directory path."""
    source = tmp_path / "source"
    source.mkdir()
    non_dir_target = tmp_path / "non_dir_target"
    non_dir_target.write_text("I am not a directory.")

    response = await client.post(
        "/workspace/rename",
        json={"old_path": "source", "new_path": "non_dir_target"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Error: File already exists"


@pytest.mark.asyncio
async def test_delete_folder_permission_error(
    client: AsyncClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Test deleting a folder when a permission error occurs."""

    # noinspection PyUnusedLocal
    def mock_rmtree(*args: Any, **kwargs: Any) -> None:
        """Mock the `shutil.rmtree` function to raise a permission error."""
        raise PermissionError("Mocked permission error")

    monkeypatch.setattr("shutil.rmtree", mock_rmtree)

    test_dir = tmp_path / "folder_with_error"
    test_dir.mkdir()

    response = await client.delete(
        "/workspace", params={"path": "folder_with_error"}
    )
    assert response.status_code == 500
    assert "Failed to delete folder" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_unreadable_file(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test uploading a file that cannot be read."""
    # Create a temporary file
    unreadable_file = tmp_path / "unreadable.txt"
    unreadable_file.write_text("This file will be unreadable.")

    # Mock aiofiles.open to raise a PermissionError during write
    mock_open = MagicMock()
    mock_file = AsyncMock()
    mock_open.return_value.__aenter__.return_value = mock_file
    mock_open.return_value.__aexit__.return_value = None
    mock_file.write.side_effect = PermissionError("Mocked permission denied")

    # Patch aiofiles.open
    with patch("aiofiles.open", mock_open):
        # Attempt to upload the file
        with open(unreadable_file, "rb") as f:
            response = await client.post(
                "/workspace/upload",
                data={"path": ""},
                files={"file": ("unreadable_file.txt", f, "text/plain")},
            )

        # Assert the response
        assert response.status_code == 500
        assert "Failed to upload file" in response.json()["detail"]


@pytest.mark.asyncio
async def test_sanitize_path_with_invalid_character(
    client: AsyncClient,
) -> None:
    response = await client.get("/workspace", params={"parent": "invalid|path"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Error: Invalid path"


@pytest.mark.asyncio
async def test_create_file_permission_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Test creating a file when a permission error occurs."""

    # noinspection PyUnusedLocal
    def mock_open(*args: Any, **kwargs: Any) -> None:
        """Mock the `aiofiles.open` function to raise a permission error."""
        raise PermissionError("Mocked permission error")

    monkeypatch.setattr("aiofiles.open", mock_open)

    response = await client.post(
        "/workspace", json={"parent": None, "type": "file"}
    )
    assert response.status_code == 500
    assert "Failed to create file" in response.json()["detail"]


@pytest.mark.asyncio
async def test_rename_file_operation_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Test renaming a file when an unexpected error occurs."""
    test_file = tmp_path / "file.txt"
    test_file.write_text("Test content")

    # noinspection PyUnusedLocal
    def mock_rename(*args: Any, **kwargs: Any) -> None:
        """Mock the `Path.rename` method to raise an OSError."""
        raise OSError("Mocked rename error")

    monkeypatch.setattr(Path, "rename", mock_rename)

    response = await client.post(
        "/workspace/rename",
        json={"old_path": "file.txt", "new_path": "renamed_file.txt"},
    )
    assert response.status_code == 500
    assert "Failed to rename file" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_folder_operation_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Test deleting a folder when an unexpected error occurs."""
    test_folder = tmp_path / "folder_to_delete"
    test_folder.mkdir()

    # noinspection PyUnusedLocal
    def mock_rmtree(*args: Any, **kwargs: Any) -> None:
        """Mock the `shutil.rmtree` function to raise an OSError."""
        raise OSError("Mocked delete error")

    monkeypatch.setattr("shutil.rmtree", mock_rmtree)

    response = await client.delete(
        "/workspace", params={"path": "folder_to_delete"}
    )
    assert response.status_code == 500
    assert "Failed to delete folder" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_text_file(client: AsyncClient, tmp_path: Path) -> None:
    """Test getting a text file returns JSON with content."""
    test_file = tmp_path / "test.py"
    test_content = "print('Hello, World!')"
    test_file.write_text(test_content)

    response = await client.get("/workspace/get", params={"path": "test.py"})

    assert response.status_code == 200
    json_response = response.json()
    assert json_response["path"] == "test.py"
    assert json_response["mime"] == "text/x-python"
    assert json_response["content"] == test_content


@pytest.mark.asyncio
async def test_get_binary_file(client: AsyncClient, tmp_path: Path) -> None:
    """Test getting a binary file returns FileResponse."""
    test_file = tmp_path / "test.png"
    # Create a minimal PNG-like binary content
    png_header = b"\x89PNG\r\n\x1a\n"
    test_file.write_bytes(png_header)

    response = await client.get("/workspace/get", params={"path": "test.png"})

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content == png_header


@pytest.mark.asyncio
async def test_get_unsupported_file(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test getting an unsupported file type returns 415 error."""
    test_file = tmp_path / "test.unsupported"
    test_file.write_text("This is an unsupported file type")

    response = await client.get(
        "/workspace/get", params={"path": "test.unsupported"}
    )

    assert response.status_code == 415
    assert "Unsupported file type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_save_text_file(client: AsyncClient, tmp_path: Path) -> None:
    """Test saving content to a text file."""
    test_file = tmp_path / "test.py"
    test_file.write_text("# Original content")

    new_content = "print('Hello, World!')"
    response = await client.post(
        "/workspace/save", json={"path": "test.py", "content": new_content}
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Saved"
    assert test_file.read_text() == new_content


@pytest.mark.asyncio
async def test_save_nonexistent_file(client: AsyncClient) -> None:
    """Test saving to a nonexistent file returns 404."""
    response = await client.post(
        "/workspace/save",
        json={"path": "nonexistent.py", "content": "print('test')"},
    )

    assert response.status_code == 404
    assert "File not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_save_unsupported_file_type(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test saving to an unsupported file type returns 415."""
    test_file = tmp_path / "test.unsupported"
    test_file.write_text("original content")

    response = await client.post(
        "/workspace/save",
        json={"path": "test.unsupported", "content": "new content"},
    )

    assert response.status_code == 415
    assert "Unsupported file type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_save_file_write_error(
    client: AsyncClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Test saving when a write error occurs."""
    test_file = tmp_path / "test.py"
    test_file.write_text("original content")

    # Mock Path.write_text to raise an exception
    def mock_write_text(*args: Any, **kwargs: Any) -> None:
        raise PermissionError("Mocked write error")

    monkeypatch.setattr(Path, "write_text", mock_write_text)

    response = await client.post(
        "/workspace/save", json={"path": "test.py", "content": "new content"}
    )

    assert response.status_code == 500
    assert "Failed to save file" in response.json()["detail"]


@pytest.mark.asyncio
async def test_sqlite_tables_nonexistent_file(client: AsyncClient) -> None:
    """Test getting tables from a nonexistent file."""
    response = await client.get(
        "/workspace/sqlite-tables", params={"path": "nonexistent.db"}
    )

    assert response.status_code == 404
    assert "File not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_sqlite_tables_non_sqlite_file(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test getting tables from a non-SQLite file."""
    test_file = tmp_path / "test.txt"
    test_file.write_text("This is not a SQLite file")

    response = await client.get(
        "/workspace/sqlite-tables", params={"path": "test.txt"}
    )

    assert response.status_code == 415
    assert "Not a SQLite file" in response.json()["detail"]


@pytest.mark.asyncio
async def test_sqlite_rows(client: AsyncClient, tmp_path: Path) -> None:
    """Test getting rows from a SQLite table."""
    # Create a test SQLite database with data
    db_file = tmp_path / "test.db"
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    cursor.execute(
        "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)"
    )

    # Insert test data
    test_data = [
        (1, "Alice", "alice@example.com"),
        (2, "Bob", "bob@example.com"),
        (3, "Charlie", "charlie@example.com"),
    ]
    cursor.executemany(
        "INSERT INTO users (id, name, email) VALUES (?, ?, ?)", test_data
    )

    conn.commit()
    conn.close()

    response = await client.get(
        "/workspace/sqlite-rows", params={"path": "test.db", "table": "users"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["table"] == "users"
    assert data["columns"] == ["id", "name", "email"]
    assert len(data["rows"]) == 3
    assert data["total"][0] == 3  # Total count
    assert data["limit"] == 50
    assert data["offset"] == 0


@pytest.mark.asyncio
async def test_sqlite_rows_with_pagination(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test getting rows with pagination parameters."""
    db_file = tmp_path / "test.db"
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    cursor.execute("CREATE TABLE numbers (id INTEGER PRIMARY KEY, value TEXT)")

    # Insert many rows for pagination testing
    test_data = [(i, f"value_{i}") for i in range(1, 101)]  # 100 rows
    cursor.executemany(
        "INSERT INTO numbers (id, value) VALUES (?, ?)", test_data
    )

    conn.commit()
    conn.close()

    response = await client.get(
        "/workspace/sqlite-rows",
        params={
            "path": "test.db",
            "table": "numbers",
            "limit": 10,
            "offset": 20,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["rows"]) == 10
    assert data["limit"] == 10
    assert data["offset"] == 20
    assert data["total"][0] == 100


@pytest.mark.asyncio
async def test_sqlite_rows_with_ordering(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test getting rows with ordering."""
    db_file = tmp_path / "test.db"
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    cursor.execute("CREATE TABLE items (id INTEGER, name TEXT)")

    # Insert data in random order
    test_data = [(3, "Charlie"), (1, "Alice"), (2, "Bob")]
    cursor.executemany("INSERT INTO items (id, name) VALUES (?, ?)", test_data)

    conn.commit()
    conn.close()

    # Test ascending order
    response = await client.get(
        "/workspace/sqlite-rows",
        params={
            "path": "test.db",
            "table": "items",
            "order_by": "name",
            "order_dir": "asc",
        },
    )

    assert response.status_code == 200
    data = response.json()
    names = [row[1] for row in data["rows"]]  # name is the second column
    assert names == ["Alice", "Bob", "Charlie"]

    # Test descending order
    response = await client.get(
        "/workspace/sqlite-rows",
        params={
            "path": "test.db",
            "table": "items",
            "order_by": "name",
            "order_dir": "desc",
        },
    )

    assert response.status_code == 200
    data = response.json()
    names = [row[1] for row in data["rows"]]
    assert names == ["Charlie", "Bob", "Alice"]


@pytest.mark.asyncio
async def test_sqlite_rows_with_search(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test getting rows with search filter."""
    db_file = tmp_path / "test.db"
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    cursor.execute(
        "CREATE TABLE products (id INTEGER, name TEXT, description TEXT)"
    )

    test_data = [
        (1, "Laptop", "Gaming laptop with high performance"),
        (2, "Mouse", "Wireless gaming mouse"),
        (3, "Keyboard", "Mechanical keyboard for programming"),
        (4, "Monitor", "4K gaming monitor"),
    ]
    cursor.executemany(
        "INSERT INTO products (id, name, description) VALUES (?, ?, ?)",
        test_data,
    )

    conn.commit()
    conn.close()

    # Search for "gaming" - should match laptop, mouse, and monitor
    response = await client.get(
        "/workspace/sqlite-rows",
        params={"path": "test.db", "table": "products", "search": "gaming"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["rows"]) == 3  # laptop, mouse, monitor

    # Search for "programming" - should match only keyboard
    response = await client.get(
        "/workspace/sqlite-rows",
        params={
            "path": "test.db",
            "table": "products",
            "search": "programming",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["rows"]) == 1


@pytest.mark.asyncio
async def test_sqlite_rows_nonexistent_table(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test getting rows from a nonexistent table."""
    db_file = tmp_path / "test.db"
    conn = sqlite3.connect(db_file)
    conn.close()  # Create empty database

    response = await client.get(
        "/workspace/sqlite-rows",
        params={"path": "test.db", "table": "nonexistent"},
    )

    assert response.status_code == 404
    assert "Table not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_sqlite_rows_invalid_order_column(
    client: AsyncClient, tmp_path: Path
) -> None:
    """Test that invalid order_by column is ignored."""
    db_file = tmp_path / "test.db"
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    cursor.execute("CREATE TABLE simple (id INTEGER, name TEXT)")
    cursor.execute("INSERT INTO simple (id, name) VALUES (1, 'test')")

    conn.commit()
    conn.close()

    # Use invalid column name - should be ignored and not cause error
    response = await client.get(
        "/workspace/sqlite-rows",
        params={
            "path": "test.db",
            "table": "simple",
            "order_by": "invalid_column",
        },
    )

    # Should still work, just without ordering
    assert response.status_code == 200
    data = response.json()
    assert len(data["rows"]) == 1


@pytest.mark.asyncio
async def test_upload_to_nonexistent_directory(client: AsyncClient) -> None:
    """Test uploading to a nonexistent directory."""
    file_content = b"test content"
    file_obj = io.BytesIO(file_content)

    response = await client.post(
        "/workspace/upload",
        data={"path": "nonexistent_dir"},
        files={"file": ("test.txt", file_obj, "text/plain")},
    )

    assert response.status_code == 404
    assert "Directory not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_file_not_found(client: AsyncClient) -> None:
    """Test getting a file that doesn't exist."""
    response = await client.get(
        "/workspace/get", params={"path": "nonexistent.txt"}
    )

    assert response.status_code == 404
    assert "Invalid request" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_file_in_nonexistent_parent(client: AsyncClient) -> None:
    """Test creating a file in a nonexistent parent directory."""
    response = await client.post(
        "/workspace", json={"parent": "nonexistent_dir", "type": "file"}
    )

    assert response.status_code == 404
    assert "Directory not found" in response.json()["detail"]
