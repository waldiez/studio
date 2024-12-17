"""Routes module for Waldiez Studio API."""

from fastapi import APIRouter

from .flow import api as flow_router
from .workspace import api as workspace_router
from .ws import router as ws_router

api_router = APIRouter()

api_router.include_router(workspace_router, tags=["Workspace"])
api_router.include_router(flow_router, tags=["Flow"])

__all__ = ["api_router", "ws_router"]
