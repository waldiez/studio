"""Websocket routes."""

import asyncio
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, WebSocket

from waldiez_studio.utils.paths import path_to_id
from waldiez_studio.utils.task_runner import TaskRunner

from .common import check_path, get_root_directory

router = APIRouter()

LOG = logging.getLogger(__name__)


# pylint: disable=unused-argument
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
    # pylint: disable=broad-except
    try:
        flow_path = check_path(
            path,
            root_dir,
            path_type="File",
            must_exist=True,
            must_be_file=True,
            must_be_dir=False,
            must_have_extension=".waldiez",
        )
    except BaseException as exc:
        LOG.error("Error: %s", exc)
        await websocket.close(code=1008, reason="Invalid path")
        return
    await websocket.accept()
    task_id = path_to_id(flow_path)
    task_runner = TaskRunner(
        task_id=task_id,
        websocket=websocket,
    )
    # pylint: disable=broad-except
    try:
        listen_task = asyncio.create_task(task_runner.listen())
        await listen_task
    except BaseException as exc:
        LOG.warning("WebSocket connection error: %s", exc)
    finally:
        try:
            await websocket.close(code=1006, reason="Connection error")
        except BaseException as error:
            LOG.error("Error closing websocket: %s", error)
