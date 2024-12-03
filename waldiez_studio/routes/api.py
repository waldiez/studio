"""API routes."""

from pathlib import Path

import aiofiles
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

from waldiez_studio.utils import get_next_id

api_router = APIRouter()

UPLOADS_DIR = Path(__file__).parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True, parents=True)


@api_router.post("/upload/")
async def upload_file(file: UploadFile = File(...)) -> JSONResponse:
    """Upload a file.

    Parameters
    ----------
    file : UploadFile
        File to upload.

    Returns
    -------
    JSONResponse
        JSON response with the filename.
    """
    extension = Path(file.filename).suffix if file.filename else ""
    new_filename = f"{get_next_id()}{extension}"
    dest = UPLOADS_DIR / new_filename
    async with aiofiles.open(dest, "wb") as out_file:
        while content := await file.read(1024):
            await out_file.write(content)
        await out_file.write(content)
    return JSONResponse(content={"path": str(dest)})
