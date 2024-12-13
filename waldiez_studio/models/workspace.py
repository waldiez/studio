"""Models for the workspace API."""

# mypy: disable-error-code="unused-ignore,assignment"

from typing import Optional

from pydantic import BaseModel

try:
    from typing import Annotated, Literal  # noqa
except ImportError:
    from typing_extensions import Annotated, Literal  # noqa


PathItemType = Literal["file", "folder"]


# pylint: disable=too-few-public-methods
class PathItem(BaseModel):
    """Represents a file or folder in the file system."""

    name: str
    path: str
    type: PathItemType


class PathItemCreateRequest(BaseModel):
    """Request for creating a new file or folder."""

    type: PathItemType
    parent: Annotated[Optional[str], "The parent folder path."] = None


class PathItemRenameRequest(BaseModel):
    """Request for renaming a file or folder."""

    old_path: str
    new_path: str


class MessageResponse(BaseModel):
    """Standard response for successful operations."""

    message: str


class PathItemListResponse(BaseModel):
    """Response for listing files and folders."""

    items: list[PathItem]
