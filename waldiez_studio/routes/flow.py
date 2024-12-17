"""Flow API routes."""

# mypy: disable-error-code="unused-ignore,assignment"
# pylint: disable=broad-except,wrong-import-order,ungrouped-imports

import json
import logging
from pathlib import Path
from typing import Any, Dict, Tuple

try:
    from typing import Literal  # noqa
except ImportError:
    from typing_extensions import Literal  # noqa

from fastapi import APIRouter, Depends, HTTPException, Query
from waldiez.exporter import WaldiezExporter

from waldiez_studio.models import PathItem, SaveFlowRequest
from waldiez_studio.utils.sync import sync_to_async

from .common import check_flow_path, get_root_directory

api = APIRouter()
LOG = logging.getLogger(__name__)


def export_flow_sync(
    flow_path: Path,
    extension: Literal["py", "ipynb"],
    root_dir: Path,
) -> Tuple[bool, int, str]:
    """Export flow synchronously.

    Parameters
    ----------
    flow_path : Path
        The path to the flow.
    extension : Literal["py", "ipynb"]
        The extension to export to.
    root_dir : Path
        The root directory of the workspace.

    Returns
    -------
    Tuple[bool, int str]
        Whether the export was successful and the destination or
        an error message with the status code.
    """
    if extension not in ("py", "ipynb"):
        LOG.error("Invalid extension: %s", extension)
        return False, 422, "Invalid extension"
    try:
        exporter = WaldiezExporter.load(file_path=flow_path)
    except BaseException as e:
        LOG.error("Error loading flow: %s", e)
        return False, 400, str(e)
    destination = flow_path.with_suffix(f".{extension}")
    try:
        exporter.export(destination, force=True)
    except BaseException as e:
        LOG.error("Error exporting flow: %s", e)
        return False, 500, str(e)
    return True, 200, str(destination.relative_to(root_dir))


@api.get(
    "/flow",
    responses={
        200: {"description": "The content of the flow."},
        400: {"description": "Error: Invalid path or file type."},
        404: {"description": "Error: File does not exist."},
        500: {"description": "Error: Could not read the flow."},
    },
)
async def get_flow_contents(
    flow_path: Path = Depends(check_flow_path),
) -> Dict[str, Any]:
    """Get the contents of a flow.

    Parameters
    ----------
    flow_path : Path
        The path to the flow.

    Returns
    -------
    WaldiezFlow
        The content of the flow.

    Raises
    ------
    HTTPException
        If the path is invalid, the file does not exist,
        the file is not a file, the file type is invalid,
        or an error occurs while reading.
    """
    return await sync_to_async(get_flow_contents_sync)(flow_path)


@api.post(
    "/flow",
    responses={
        200: {"description": "Flow saved successfully."},
        400: {"description": "Error: Invalid path or file type."},
        404: {"description": "Error: File does not exist."},
        500: {"description": "Error: Could not save the flow."},
    },
)
async def save_flow_contents(
    data: SaveFlowRequest,
    flow_path: Path = Depends(check_flow_path),
) -> PathItem:
    """Save the content of a flow.

    Parameters
    ----------
    flow_path : Path
        The path to the flow.
    data : Dict[str, Any]
        The content of the flow.

    Returns
    -------
    Dict[str, str]
        Whether the save was successful or an error message.

    Raises
    ------
    HTTPException
        If the path is invalid, the file type is invalid,
        or an error occurs while writing.
    """
    contents = (
        data.contents
        if isinstance(data.contents, str)
        else json.dumps(data.contents)
    )
    try:
        await sync_to_async(flow_path.write_text)(contents, encoding="utf-8")
    except Exception as e:
        LOG.error("Error writing file: %s", e)
        raise HTTPException(
            status_code=500, detail="Error: Could not save the flow"
        ) from e
    return PathItem(
        path=str(flow_path.relative_to(flow_path.parent.parent)),
        type="file",
        name=flow_path.name,
    )


@api.post(
    "/flow/export",
    responses={
        200: {"description": "The content of the flow."},
        400: {"description": "Error: Invalid path or file type."},
        404: {"description": "Error: File does not exist."},
        500: {"description": "Error: Could not export the flow."},
    },
)
async def export_flow(
    extension: Literal["py", "ipynb"] = Query(
        ..., description="The extension to export to."
    ),
    flow_path: Path = Depends(check_flow_path),
    root_dir: Path = Depends(get_root_directory),
) -> PathItem:
    """Export a flow to a Python script or Jupyter notebook.

    Parameters
    ----------
    extension : Literal["py", "ipynb"]
        The extension to export to.
    flow_path : Path
        The path to the flow.
    root_dir : Path
        The root directory of the workspace.

    Returns
    -------
    Dict[str, str]
        Whether the export was successful and the destination or error message.

    Raises
    ------
    HTTPException
        If the path is invalid, the file type is invalid,
        or an error occurs while exporting.
    """
    success, status, message = await sync_to_async(export_flow_sync)(
        flow_path, extension, root_dir
    )
    if not success:
        raise HTTPException(status_code=status, detail=message)
    return PathItem(
        path=message,
        type="file",
        name=flow_path.name,
    )


def get_flow_contents_sync(flow_path: Path) -> Dict[str, Any]:
    """Get the contents of a flow synchronously.

    Parameters
    ----------
    flow_path : Path
        The path to the flow.

    Returns
    -------
    WaldiezFlow | Dict[str, Any]
        The content of the flow.

    Raises
    ------
    HTTPException
        If an error occurs while reading.
    """
    try:
        flow_text = flow_path.read_text(encoding="utf-8")
        LOG.debug("Flow contents: %s", flow_text)
        return json.loads(flow_text)
    except Exception as e:
        LOG.error("Error reading file: %s", e)
        raise HTTPException(
            status_code=500, detail="Error: Could not read the flow contents"
        ) from e
