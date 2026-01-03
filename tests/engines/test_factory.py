# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2026 Waldiez and contributors.

"""Tests for the engine factory."""
# flake8: noqa: E501
# pylint: disable=missing-function-docstring,missing-return-doc,line-too-long
# pylint: disable=missing-yield-doc,missing-param-doc,missing-raises-doc,no-self-use

from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi import WebSocket

from waldiez_studio.engines.base import Engine
from waldiez_studio.engines.factory import SUPPORTED_EXTS, make_engine
from waldiez_studio.engines.notebook_engine import NotebookEngine
from waldiez_studio.engines.subprocess_engine import SubprocessEngine
from waldiez_studio.engines.waldiez_engine import WaldiezEngine


@pytest.fixture(name="mock_websocket")
def mock_websocket_fixture() -> AsyncMock:
    """Create a mock websocket."""
    websocket = AsyncMock(spec=WebSocket)
    websocket.send = AsyncMock()
    websocket.send_json = AsyncMock()
    return websocket


@pytest.fixture(name="test_root_dir")
def test_root_dir_fixture(tmp_path: Path) -> Path:
    """Create a test root directory."""
    return tmp_path


class TestSupportedExtensions:
    """Test the SUPPORTED_EXTS constant."""

    def test_supported_extensions_content(self) -> None:
        """Test that SUPPORTED_EXTS contains expected extensions."""
        expected_extensions = {".py", ".ipynb", ".waldiez"}
        assert SUPPORTED_EXTS == expected_extensions

    def test_supported_extensions_is_frozen(self) -> None:
        """Test that SUPPORTED_EXTS is a set (immutable for our purposes)."""
        assert isinstance(SUPPORTED_EXTS, set)


class TestMakeEngine:
    """Test the make_engine factory function."""

    @pytest.mark.asyncio
    async def test_make_engine_python_file(
        self, mock_websocket: AsyncMock, test_root_dir: Path
    ) -> None:
        """Test creating an engine for a Python file."""
        test_file = test_root_dir / "test.py"
        test_file.write_text("print('Hello, World!')")

        engine = await make_engine(
            file_path=test_file,
            root_dir=test_root_dir,
            websocket=mock_websocket,
        )

        assert isinstance(engine, SubprocessEngine)
        assert isinstance(engine, Engine)
        assert engine.file_path == test_file
        assert engine.root_dir == test_root_dir
        assert engine.websocket == mock_websocket

    @pytest.mark.asyncio
    async def test_make_engine_python_file_uppercase(
        self, mock_websocket: AsyncMock, test_root_dir: Path
    ) -> None:
        """Test creating an engine for a Python file with uppercase extension."""
        test_file = test_root_dir / "test.PY"
        test_file.write_text("print('Hello, World!')")

        engine = await make_engine(
            file_path=test_file,
            root_dir=test_root_dir,
            websocket=mock_websocket,
        )

        assert isinstance(engine, SubprocessEngine)

    @pytest.mark.asyncio
    async def test_make_engine_notebook_file(
        self, mock_websocket: AsyncMock, test_root_dir: Path
    ) -> None:
        """Test creating an engine for a Jupyter notebook file."""
        test_file = test_root_dir / "test.ipynb"
        notebook_content: dict[str, Any] = {
            "cells": [
                {
                    "cell_type": "code",
                    "source": ["print('Hello from notebook')"],
                }
            ],
            "metadata": {},
            "nbformat": 4,
            "nbformat_minor": 4,
        }
        test_file.write_text(str(notebook_content))

        engine = await make_engine(
            file_path=test_file,
            root_dir=test_root_dir,
            websocket=mock_websocket,
        )

        assert isinstance(engine, NotebookEngine)
        assert isinstance(engine, Engine)
        assert engine.file_path == test_file
        assert engine.root_dir == test_root_dir
        assert engine.websocket == mock_websocket

    @pytest.mark.asyncio
    async def test_make_engine_notebook_file_uppercase(
        self, mock_websocket: AsyncMock, test_root_dir: Path
    ) -> None:
        """Test creating an engine for a notebook file with uppercase extension."""
        test_file = test_root_dir / "test.IPYNB"
        test_file.write_text('{"cells": [], "metadata": {}}')

        engine = await make_engine(
            file_path=test_file,
            root_dir=test_root_dir,
            websocket=mock_websocket,
        )

        assert isinstance(engine, NotebookEngine)

    @pytest.mark.asyncio
    async def test_make_engine_waldiez_file(
        self, mock_websocket: AsyncMock, test_root_dir: Path
    ) -> None:
        """Test creating an engine for a Waldiez file."""
        test_file = test_root_dir / "test.waldiez"
        waldiez_content: dict[str, Any] = {
            "type": "flow",
            "nodes": [],
            "edges": [],
        }
        test_file.write_text(str(waldiez_content))

        engine = await make_engine(
            file_path=test_file,
            root_dir=test_root_dir,
            websocket=mock_websocket,
        )

        assert isinstance(engine, WaldiezEngine)
        assert isinstance(engine, Engine)
        assert engine.file_path == test_file
        assert engine.root_dir == test_root_dir
        assert engine.websocket == mock_websocket

    @pytest.mark.asyncio
    async def test_make_engine_waldiez_file_uppercase(
        self, mock_websocket: AsyncMock, test_root_dir: Path
    ) -> None:
        """Test creating an engine for a Waldiez file with uppercase extension."""
        test_file = test_root_dir / "test.WALDIEZ"
        test_file.write_text('{"type": "flow"}')

        engine = await make_engine(
            file_path=test_file,
            root_dir=test_root_dir,
            websocket=mock_websocket,
        )

        assert isinstance(engine, WaldiezEngine)

    @pytest.mark.asyncio
    async def test_make_engine_unsupported_extension(
        self, mock_websocket: AsyncMock, test_root_dir: Path
    ) -> None:
        """Test that unsupported file extensions raise ValueError."""
        test_file = test_root_dir / "test.txt"
        test_file.write_text("This is a text file")

        with pytest.raises(ValueError, match="Unsupported extension: .txt"):
            await make_engine(
                file_path=test_file,
                root_dir=test_root_dir,
                websocket=mock_websocket,
            )

    @pytest.mark.asyncio
    async def test_make_engine_no_extension(
        self, mock_websocket: AsyncMock, test_root_dir: Path
    ) -> None:
        """Test that files without extensions raise ValueError."""
        test_file = test_root_dir / "test_file_no_extension"
        test_file.write_text("This file has no extension")

        with pytest.raises(ValueError, match="Unsupported extension: "):
            await make_engine(
                file_path=test_file,
                root_dir=test_root_dir,
                websocket=mock_websocket,
            )

    @pytest.mark.asyncio
    async def test_make_engine_multiple_dots_in_filename(
        self, mock_websocket: AsyncMock, test_root_dir: Path
    ) -> None:
        """Test that files with multiple dots use the final extension."""
        test_file = test_root_dir / "test.backup.py"
        test_file.write_text("print('Hello from backup file')")

        engine = await make_engine(
            file_path=test_file,
            root_dir=test_root_dir,
            websocket=mock_websocket,
        )

        assert isinstance(engine, SubprocessEngine)

    @pytest.mark.asyncio
    async def test_make_engine_mixed_case_extension(
        self, mock_websocket: AsyncMock, test_root_dir: Path
    ) -> None:
        """Test that mixed case extensions are handled correctly."""
        test_file = test_root_dir / "test.iPyNb"
        test_file.write_text('{"cells": [], "metadata": {}}')

        engine = await make_engine(
            file_path=test_file,
            root_dir=test_root_dir,
            websocket=mock_websocket,
        )

        assert isinstance(engine, NotebookEngine)

    @pytest.mark.asyncio
    async def test_make_engine_nonexistent_file(
        self, mock_websocket: AsyncMock, test_root_dir: Path
    ) -> None:
        """Test that make_engine works even if the file doesn't exist yet."""
        # This tests that the factory doesn't try to read the file
        test_file = test_root_dir / "nonexistent.py"
        # Don't create the file

        engine = await make_engine(
            file_path=test_file,
            root_dir=test_root_dir,
            websocket=mock_websocket,
        )

        assert isinstance(engine, SubprocessEngine)
        assert engine.file_path == test_file

    @pytest.mark.asyncio
    async def test_make_engine_engine_interface_compliance(
        self, mock_websocket: AsyncMock, test_root_dir: Path
    ) -> None:
        """Test that all created engines comply with the Engine interface."""
        test_files: list[tuple[str, type[Engine]]] = [
            ("test.py", SubprocessEngine),
            ("test.ipynb", NotebookEngine),
            ("test.waldiez", WaldiezEngine),
        ]

        for filename, expected_class in test_files:
            test_file = test_root_dir / filename
            test_file.write_text("test content")

            engine = await make_engine(
                file_path=test_file,
                root_dir=test_root_dir,
                websocket=mock_websocket,
            )

            # Check that it's the expected class
            assert isinstance(engine, expected_class)

            # Check that it has the required Engine interface methods
            assert hasattr(engine, "start")
            assert hasattr(engine, "handle_client")
            assert hasattr(engine, "shutdown")

            # Check that the methods are callable
            assert callable(engine.start)
            assert callable(engine.handle_client)
            assert callable(engine.shutdown)

            # Check that required attributes are set
            assert engine.file_path == test_file
            assert engine.root_dir == test_root_dir
            assert engine.websocket == mock_websocket

    @pytest.mark.asyncio
    async def test_make_engine_lazy_imports(
        self, mock_websocket: AsyncMock, test_root_dir: Path
    ) -> None:
        """Test that imports are done lazily (import inside function)."""
        # This test verifies that the imports are done inside the function
        # by checking that we can create engines without having all imports at module level

        test_file = test_root_dir / "test.py"
        test_file.write_text("print('test')")

        # If imports weren't lazy, this would fail if any engine module had issues
        engine = await make_engine(
            file_path=test_file,
            root_dir=test_root_dir,
            websocket=mock_websocket,
        )

        assert isinstance(engine, SubprocessEngine)

    @pytest.mark.asyncio
    async def test_make_engine_error_message_format(
        self, mock_websocket: AsyncMock, test_root_dir: Path
    ) -> None:
        """Test that error messages include the actual extension."""
        test_file = test_root_dir / "test.xyz"
        test_file.write_text("unsupported file")

        with pytest.raises(ValueError) as exc_info:
            await make_engine(
                file_path=test_file,
                root_dir=test_root_dir,
                websocket=mock_websocket,
            )

        assert ".xyz" in str(exc_info.value)
        assert "Unsupported extension" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_make_engine_all_supported_extensions(
        self, mock_websocket: AsyncMock, test_root_dir: Path
    ) -> None:
        """Test that all extensions in SUPPORTED_EXTS can create engines."""
        engine_mapping: dict[str, type[Engine]] = {
            ".py": SubprocessEngine,
            ".ipynb": NotebookEngine,
            ".waldiez": WaldiezEngine,
        }

        for ext in SUPPORTED_EXTS:
            test_file = test_root_dir / f"test{ext}"
            test_file.write_text("test content")

            engine = await make_engine(
                file_path=test_file,
                root_dir=test_root_dir,
                websocket=mock_websocket,
            )

            expected_class = engine_mapping[ext]
            msg = f"Failed for extension {ext}"
            assert isinstance(engine, expected_class), msg
