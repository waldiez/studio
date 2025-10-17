/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { create } from "zustand";

export type ConsoleLine = {
    kind: "stdout" | "stderr" | "system";
    text: string;
    ts: number;
};

type ConsoleState = {
    lines: ConsoleLine[];
    push: (l: ConsoleLine) => void;
    clear: () => void;
};
function extractIdIfJson(line: string): string | null {
    const trimmed = line.trim();

    // quick cheap test to skip obvious non-JSON
    if (!trimmed.startsWith("{") || !trimmed.includes('"id"')) {
        return null;
    }

    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && typeof parsed.id === "string") {
            return parsed.id;
        }
    } catch {
        /* not valid JSON, ignore */
    }
    return null;
}
const seenIds = new Set<string>();
const MAX_IDS = 1000;

function rememberId(id: string) {
    seenIds.add(id);
    if (seenIds.size > MAX_IDS) {
        const first = seenIds.values().next().value;
        if (first) {
            seenIds.delete(first);
        }
    }
}
export const useConsole = create<ConsoleState>(set => ({
    lines: [],
    push: line =>
        set(state => {
            const id = extractIdIfJson(line.text);
            if (!id) {
                return { lines: [...state.lines, line] };
            }
            if (seenIds.has(id)) {
                return state;
            }

            rememberId(id);
            return { lines: [...state.lines, line] };
        }),

    clear: () => {
        seenIds.clear();
        set({ lines: [] });
    },
}));

export const pushConsole = (line: ConsoleLine) => {
    useConsole.getState().push(line);
};
