# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.
# pylint: disable=too-many-try-statements,broad-exception-caught
"""Task runner to delegate the task to the appropriate engine."""

import asyncio
import contextlib
import json
import logging
import traceback
from typing import Any

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

from waldiez_studio.engines import Engine

LOG = logging.getLogger(__name__)

MAX_ACTIVE_TASKS = 10
_active_tasks = asyncio.Semaphore(MAX_ACTIVE_TASKS)


class TaskRunner:
    """Task runner to delegate the task to the appropriate engine."""

    def __init__(
        self, task_id: str, websocket: WebSocket, engine: Engine
    ) -> None:
        self.task_id = task_id
        self.websocket = websocket
        self.engine = engine

    # pylint: disable=too-complex
    async def listen(self) -> None:  # noqa: C901
        """Start listening.

        Raises
        ------
        asyncio.CancelledError
            If the task is cancelled.
        """
        async with _active_tasks:  # limit concurrent runs
            try:
                # First message must be op=start
                try:
                    raw = await self.websocket.receive_text()
                    start_msg = json.loads(raw)
                except Exception:
                    await self.send(
                        {
                            "type": "error",
                            "data": {"message": "invalid first message"},
                        }
                    )
                    return

                if start_msg.get("op") != "start":
                    await self.send(
                        {
                            "type": "error",
                            "data": {
                                "message": "first message must be op=start"
                            },
                        }
                    )
                    return

                await self.engine.start(start_msg)

                while True:
                    try:
                        raw = await self.websocket.receive_text()
                        msg = json.loads(raw)
                    except WebSocketDisconnect:
                        LOG.debug("WS disconnected")
                        break
                    except Exception:
                        await self.send(
                            {
                                "type": "error",
                                "data": {"message": "invalid message"},
                            }
                        )
                        continue

                    await self.engine.handle_client(msg)
                    # if msg.get("op") == "shutdown":
                    #     break

            except WebSocketDisconnect:  # pragma: no cover
                LOG.info("WS disconnected early")
            except asyncio.CancelledError:
                LOG.debug("TaskRunner cancelled")
                raise
            except Exception as exc:
                traceback.print_exc()
                LOG.warning("TaskRunner error: %s", exc)
            finally:
                with contextlib.suppress(Exception):
                    await self.engine.shutdown()

    async def send(self, payload: dict[str, Any]) -> None:
        """Safe send a message.

        Parameters
        ----------
        payload : dict[str, Any]
            The message to send.
        """
        with contextlib.suppress(Exception):
            await self.websocket.send_json(payload)
