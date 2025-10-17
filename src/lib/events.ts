/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
export const bus = new EventTarget();

const WORKSPACE_CHANGED = "workspace:changed";

export function emitWorkspaceChanged(detail: { path?: string; parent?: string }) {
  bus.dispatchEvent(new CustomEvent(WORKSPACE_CHANGED, { detail }));
}

export function onWorkspaceChanged(
  handler: (detail: { path?: string; parent?: string }) => void
): () => void {
  const listener = (e: Event) => handler((e as CustomEvent).detail || {});
  bus.addEventListener(WORKSPACE_CHANGED, listener);
  return () => bus.removeEventListener(WORKSPACE_CHANGED, listener);
}

export type RunMode = "chat" | "step";
export type RunRequest = { path: string; mode?: RunMode, contents?: string, args?: string[] };

const RUN_REQUESTED = "run:requested";
const RUN_STOP_REQUESTED = "run:stop";

/** Ask whoever owns that path to start running it (mode optional). */
export function emitRunRequested(detail: RunRequest) {
  bus.dispatchEvent(new CustomEvent<RunRequest>(RUN_REQUESTED, { detail }));
}

/** Listen for run requests. Returns an unsubscribe function. */
export function onRunRequested(handler: (detail: RunRequest) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<RunRequest>).detail);
  bus.addEventListener(RUN_REQUESTED, listener);
  return () => bus.removeEventListener(RUN_REQUESTED, listener);
}

/** Ask the current runner (if any) to stop. */
export function emitRunStopRequested() {
  bus.dispatchEvent(new CustomEvent(RUN_STOP_REQUESTED));
}

/** Listen for stop requests (no payload). */
export function onRunStopRequested(handler: () => void): () => void {
  const listener = () => handler();
  bus.addEventListener(RUN_STOP_REQUESTED, listener);
  return () => bus.removeEventListener(RUN_STOP_REQUESTED, listener);
}
