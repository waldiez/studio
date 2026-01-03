/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import { wsPrefix } from "@/env";

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
export type TermController = {
  send: (data: string) => void;
  resize: (rows: number, cols: number) => void;
  interrupt: () => void;
  terminate: () => void;
  close: () => void;
  ready: () => boolean;
};

export function openTerminal(
  cwd: string | undefined,
  onData: (s: string) => void,
  onExit?: () => void
): TermController {
  const qs = new URLSearchParams();
  if (cwd) {qs.set("cwd", cwd.replace(/^\/+/, ""));} // workspace-relative
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${location.host}${wsPrefix}/terminal?${qs.toString()}`;

  const ws = new WebSocket(url);

  let isOpen = false;
  const outQueue: any[] = [];

  const flush = () => {
    if (!isOpen) {return;}
    while (outQueue.length) {
      ws.send(JSON.stringify(outQueue.shift()));
    }
  };

  const sendOp = (op: any) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(op));
    } else {
      outQueue.push(op);
    }
  };

  ws.onopen = () => {
    isOpen = true;
    outQueue.unshift({ op: "start" }); // ensure start goes first
    flush();
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg?.type === "data") {onData(msg.data as string);}
      else if (msg?.type === "session_end") {onExit?.();}
    } catch {
      // ignore non-JSON
    }
  };

  ws.onclose = () => { isOpen = false; };
  ws.onerror = () => { /* swallow */ };

  return {
    send: (data) => sendOp({ op: "stdin", data }),
    resize: (rows, cols) => sendOp({ op: "resize", rows, cols }),
    interrupt: () => sendOp({ op: "interrupt" }),
    terminate: () => sendOp({ op: "terminate" }),
    close: () => ws.close(),
    ready: () => isOpen,
  };
}
