# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# pylint: disable=broad-exception-caught
# pyright: reportCallInDefaultInitializer=false
"""Websocket routes."""

import contextlib
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from waldiez_studio.engines import SUPPORTED_EXTS, Engine, make_engine
from waldiez_studio.utils.paths import path_to_id
from waldiez_studio.utils.task_runner import TaskRunner

from .common import check_path, get_root_directory

router = APIRouter()

LOG = logging.getLogger(__name__)


# pylint: disable=unused-argument
# noinspection PyBroadException
@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    path: str,
    root_dir: Path = Depends(get_root_directory),
) -> None:
    """Websocket endpoint.

    Parameters
    ----------
    websocket : WebSocket
        The websocket.
    path : str
        The path to the flow.
    root_dir : Path
        The root directory of the workspace
    """
    try:
        file_path = check_path(
            path,
            root_dir,
            path_type="File",
            must_exist=True,
            must_be_file=True,
            must_be_dir=False,
            must_have_extension=SUPPORTED_EXTS,
        )
    except BaseException as exc:
        LOG.error("Error: %s", exc)
        await websocket.close(code=1008, reason="Invalid path")
        return
    engine: Engine | None = None
    error: Exception | None = None
    # pylint: disable=too-many-try-statements
    try:
        await websocket.accept()
        engine = await make_engine(
            file_path=file_path, root_dir=root_dir, websocket=websocket
        )
        task_id = path_to_id(file_path)
        runner = TaskRunner(
            task_id=task_id,
            websocket=websocket,
            engine=engine,
        )
        await runner.listen()
    except WebSocketDisconnect as exc:
        error = exc
        LOG.info("WebSocket disconnected: %s", file_path)
    except Exception as exc:  # pylint: disable=broad-exception-caught
        error = exc  # pylint: disable=redefined-variable-type
        LOG.warning("WebSocket error for %s: %s", file_path, exc)
    finally:
        # if engine:
        #     with contextlib.suppress(Exception):
        #         await engine.shutdown()
        with contextlib.suppress(Exception):
            code = 1000 if not error else 1006
            reason = str(error) if error else None
            await websocket.close(code=code, reason=reason)
