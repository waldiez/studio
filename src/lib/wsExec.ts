/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { wsPrefix } from "@/env";
import type { ExecEvent } from "@/types/events";

export type StartOptions = {
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  venv?: string;
  freshKernel?: boolean;
};

export type ExecController = {
  stdin: (text: string) => void;
  stdinEOF: () => void;
  interrupt: () => void;
  terminate: () => void;
  kill: () => void;
  shutdown: () => void;
  close: () => void;
  send: (m: any) => void;
  socket: WebSocket;
};

export function openExec(filePath: string, onEvent: (e: ExecEvent) => void, start?: {
  args?: string[]; env?: Record<string,string>; cwd?: string; freshKernel?: boolean; venv?: string; timeoutSec?: number;
}): ExecController {
  const u = new URL(window.location.origin.replace("http", "ws") + wsPrefix);
  u.searchParams.set("path", filePath);
  const ws = new WebSocket(u);

  ws.onopen = () => ws.send(JSON.stringify({ op: "start", ...start }));
  ws.onmessage = (ev) => { try { onEvent(JSON.parse(ev.data)); } catch {
    onEvent({ type: "error", data: { message: "Malformed message" } } as ExecEvent);
  } };
   ws.onerror = () => {
    onEvent({ type: "error", data: { message: "WebSocket error" } } as ExecEvent);
  };

  const send = (m: any) => { if (ws.readyState === WebSocket.OPEN) {ws.send(JSON.stringify(m));} };

  return {
    stdin: (text) => send({ op: "stdin", text }),
    stdinEOF: () => send({ op: "stdin_eof" }),
    interrupt: () => send({ op: "interrupt" }),
    terminate: () => send({ op: "terminate" }),
    kill: () => send({ op: "kill" }),
    shutdown: () => send({ op: "shutdown" }),
    close: () => send({op: "shutdown"}),
    send,
    socket: ws,
  };
}
