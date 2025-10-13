# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

# pylint: disable=broad-exception-caught,too-many-try-statements
# pyright: reportCallInDefaultInitializer=false

"""Terminal websocket route."""

import asyncio
import contextlib
import json
import os
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)

from waldiez_studio.utils.terminal_session import get_session

from .common import get_root_directory

router = APIRouter()


def _safe_workdir(root: Path, rel: str | None) -> Path:
    base = root.resolve()
    target = (base / (rel or "")).resolve()
    if base == target or str(target).startswith(str(base) + os.sep):
        return target if target.exists() else base
    raise ValueError("cwd outside workspace")


# pylint: disable=too-complex,too-many-locals,
# pylint: disable=too-many-branches,too-many-statements
@router.websocket("/ws/terminal")
async def terminal_ws(  # noqa: C901
    ws: WebSocket,
    cwd: str | None = None,
    root_dir: Path = Depends(get_root_directory),
) -> None:
    """Terminal websocket endpoint.

    Parameters
    ----------
    ws : Websocket
        The websocket.
    cwd : str | None
        The working directory to use, defaults to None
    root_dir : Path
        The root directory dependency.

    Raises
    ------
    ValueError
        If the cwd is not inside the workspace.
    HTTPException
        If sth goes wrong.
    """
    await ws.accept()
    try:
        workdir = _safe_workdir(root_dir, cwd)
    except Exception as exc:
        # close with a clear reason
        with contextlib.suppress(Exception):
            await ws.close(code=1008, reason="Invalid cwd")
        raise HTTPException(400, "Invalid cwd") from exc

    session = get_session(workdir)

    stop = asyncio.Event()
    sent_end = False  # ensure we only notify end once

    async def _notify_end_once() -> None:
        nonlocal sent_end
        if sent_end:
            return
        sent_end = True
        with contextlib.suppress(Exception):
            # single, consistent end-of-session event
            await ws.send_json({"type": "session_end"})

    async def _reader() -> None:
        """Pump PTY -> WS."""
        try:  # pragma: no branch
            while not stop.is_set():
                data = await session.read(4096)
                if not data:
                    # allow other tasks to run & check liveness
                    await asyncio.sleep(0.01)
                    if not session.is_alive():
                        await _notify_end_once()
                        break
                    continue
                with contextlib.suppress(Exception):
                    await ws.send_json(
                        {"type": "data", "data": data.decode("utf-8", "ignore")}
                    )
        except asyncio.CancelledError:
            # normal on ws/tab close or shutdown
            pass
        except Exception:  # pragma: no cover
            # swallow—socket may be closing
            pass
        finally:
            stop.set()

    read_task = asyncio.create_task(_reader())

    # process an initial message (e.g., resize from client)
    try:
        with contextlib.suppress(Exception):
            msg = await asyncio.wait_for(ws.receive_text(), timeout=1.0)
            payload = json.loads(msg)
            if payload.get("op") == "resize":
                session.resize(
                    int(payload.get("rows") or 24),
                    int(payload.get("cols") or 80),
                )
    except Exception:  # pragma: no cover
        pass

    try:
        while not stop.is_set():
            try:
                raw = await ws.receive_text()
            except WebSocketDisconnect:
                break
            except Exception:  # pragma: no cover
                break

            try:
                payload = json.loads(raw)
            except Exception:  # nosemgrep # nosec # pragma: no cover
                continue

            op = payload.get("op")
            if op == "stdin":
                data = payload.get("data") or ""
                session.write(data.encode("utf-8", "ignore"))
            elif op == "resize":
                session.resize(
                    int(payload.get("rows") or 24),
                    int(payload.get("cols") or 80),
                )
            elif op == "interrupt":
                session.interrupt()
            elif op in ("terminate", "kill"):
                session.terminate()
                await _notify_end_once()
                break
    finally:
        stop.set()
        # cancel reader and ignore cancellation/context shutdown
        if not read_task.done():
            with contextlib.suppress(Exception):
                read_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await read_task

        await _notify_end_once()
        session.close()
        with contextlib.suppress(Exception):
            await ws.close()
