"""I/O stream utilities."""

import asyncio
import json
import logging
from typing import Any, Dict, List, Tuple

from autogen.io.websockets import IOWebsockets, ServerConnection  # type: ignore
from fastapi import WebSocket

INPUT_INDICATOR = (
    "Press enter to skip and use auto-reply, "
    "or type 'exit' to end the conversation:"
)
START_PROMPT = "Enter your message to start the conversation:"
LOG = logging.getLogger(__name__)

Data = str | bytes
Message = Data | Dict[str, Data] | List[Data]


class WsServerConnection(ServerConnection):
    """Websocket server connection."""

    def __init__(
        self,
        websocket: WebSocket,
        loop: asyncio.AbstractEventLoop,
        input_timeout: float = 120,
    ):
        """Initialize the websocket server connection.

        Parameters
        ----------
        websocket : WebSocket
            The websocket.
        loop : asyncio.AbstractEventLoop
            The event loop.
        input_timeout : float, optional
            The input timeout in seconds, by default 120.
        """
        self.loop = loop
        self.websocket = websocket
        self.timeout = input_timeout

    def recv(self, timeout: float | None = None) -> str:
        """Receive data from the websocket.

        Parameters
        ----------
        timeout : float, optional
            The timeout in seconds, by default None.

        Returns
        -------
        str
            The received data.
        """
        future = asyncio.run_coroutine_threadsafe(
            self.websocket.receive_json(), self.loop
        )
        # pylint: disable=broad-except,too-many-try-statements
        try:
            result = future.result(timeout or self.timeout)
            if not result:
                return "\n"
            if isinstance(result, dict):
                return result.get("payload", "\n")
            return result

        except BaseException as exc:
            LOG.error("Error receiving data: %s", exc)
            return "\n"

    @staticmethod
    def is_input_prompt(message: Message) -> Tuple[bool, str]:
        """Check if the message is an input prompt.

        Parameters
        ----------
        message : str
            The message to check.

        Returns
        -------
        bool
            Whether the message is an input prompt.
        """
        if not isinstance(message, (str, bytes)):
            return False, get_print_data_string(message)
        message_string = (
            message if isinstance(message, str) else message.decode()
        )
        stripped = message_string.strip()
        if stripped in (">", ">>") or stripped.endswith(INPUT_INDICATOR):
            return True, (
                stripped if stripped.endswith(INPUT_INDICATOR) else START_PROMPT
            )
        return False, get_print_data_string(message)

    # pylint: disable=unused-argument
    def send(self, message: Message, **kwargs: Any) -> None:
        """Send data to the websocket.

        Parameters
        ----------
        message : Message
            The message to send
        kwargs : Any
            Additional keyword arguments.
        """
        is_input, message_string = self.is_input_prompt(message)
        data_dict = {
            "type": "print",
            "data": message_string,
        }
        if is_input:
            # le'ts also send the input prompt
            asyncio.run_coroutine_threadsafe(
                self.websocket.send_json(data_dict), self.loop
            ).result()
            data_dict["type"] = "input"
        asyncio.run_coroutine_threadsafe(
            self.websocket.send_json(data_dict), self.loop
        ).result()


def get_print_data_string(message: Message) -> str:
    """Get the print data string.

    Parameters
    ----------
    message : Message
        The message.

    Returns
    -------
    str
        The print data string.
    """
    if isinstance(message, bytes):
        return message.decode()
    if isinstance(message, str):
        return message
    if isinstance(message, (dict, list)):
        return json.dumps(message)
    return str(message)


class IOWebsocketsStream(IOWebsockets):
    """Websocket I/O stream."""

    def __init__(self, websocket: WebSocket, loop: asyncio.AbstractEventLoop):
        """Initialize the websocket I/O stream.

        Parameters
        ----------
        server_connection : WsServerConnection
            The websocket server connection.
        """
        self.server_connection = WsServerConnection(
            websocket=websocket, loop=loop
        )
        super().__init__(self.server_connection)

    def print(self, *args: Any, **kwargs: Any) -> None:
        """Print the message.

        Parameters
        ----------
        args : Any
            The message to print.
        kwargs : Any
            Additional keyword arguments.
        """
        message = " ".join(str(arg) for arg in args)
        if "file" in kwargs:
            file = kwargs.pop("file")
            if hasattr(file, "getvalue"):
                message += file.getvalue()
        end = kwargs.get("end", "\n")
        message += end
        self.server_connection.send(message)
