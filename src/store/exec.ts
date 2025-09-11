/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { type ExecController, type StartOptions, openExec } from "@/lib/wsExec";
import { type ExecEvent } from "@/types/events";

import { create } from "zustand";

export type ExecLine = {
    kind: "stdout" | "stderr" | "system";
    text: string;
    ts: number;
};

type Listener = (evt: ExecEvent) => void;
const listeners = new Set<Listener>();

type ExecState = {
    running: boolean;
    startedAt: number | null;
    taskPath?: string | null;
    ctrl?: ExecController | null;
    lines: ExecLine[];
    addListener: (fn: Listener) => () => void;
    run: (path: string, opts?: StartOptions) => void;
    stop: () => void;
    clear: () => void;
    push: (line: ExecLine) => void;
};
const getErrorMsg = (evt: any) => {
    if (typeof evt === "string") {
        return evt;
    }
    if (!evt) {
        return "";
    }
    if (typeof evt === "object") {
        if ("data" in evt) {
            return getErrorMsg(evt.data);
        }
        if ("error" in evt) {
            return getErrorMsg(evt.error);
        }
        if ("text" in evt) {
            return getErrorMsg(evt.text);
        }
        return evt ? JSON.stringify(evt) : "";
    }
    return String(evt);
};
export const useExec = create<ExecState>((set, get) => ({
    running: false,
    startedAt: null,
    taskPath: null,
    ctrl: null,
    lines: [],

    addListener: fn => {
        listeners.add(fn);
        return () => listeners.delete(fn);
    },
    push: line => set(s => ({ lines: [...s.lines, line] })),
    clear: () => set({ lines: [] }),

    stop: () => {
        const { ctrl } = get();
        ctrl?.close?.();
        set({ running: false, taskPath: null, ctrl: null, startedAt: null });
    },

    run: (path, opts) => {
        const { running, ctrl, push, stop } = get();
        if (running || ctrl) {
            stop();
        }

        set({ running: true, taskPath: path, startedAt: Date.now(), lines: [] });

        const next = openExec(
            path,
            evt => {
                if (evt.type === "run_stdout") {
                    push({ kind: "stdout", text: evt.data?.text ?? "", ts: Date.now() });
                } else if (evt.type === "run_stderr" || evt.type === "error") {
                    const errorMsg = getErrorMsg(evt);
                    push({ kind: "stderr", text: errorMsg, ts: Date.now() });
                } else if (evt.type === "run_status") {
                    push({ kind: "system", text: `[status] ${evt.data?.state}`, ts: Date.now() });
                } else if (evt.type === "run_end") {
                    push({
                        kind: "system",
                        text: `[end] code=${evt.data?.returnCode} elapsed=${evt.data?.elapsedMs}ms`,
                        ts: Date.now(),
                    });
                    set({ running: false, ctrl: null, taskPath: null, startedAt: null });
                }
                for (const fn of listeners) {
                    try {
                        fn(evt);
                    } catch {
                        //
                    }
                }
            },
            { ...opts },
        );

        set({ ctrl: next });
    },
}));

// helper (use outside store)
export const pushExecLine = (line: ExecLine) => useExec.setState(s => ({ lines: [...s.lines, line] }));
