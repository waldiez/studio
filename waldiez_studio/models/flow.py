"""Models for the flow API."""

from typing import Any, Dict

from pydantic import BaseModel

# pylint: disable=too-few-public-methods


class SaveFlowRequest(BaseModel):
    """Represents a flow in the workspace."""

    contents: Dict[str, Any] | str
