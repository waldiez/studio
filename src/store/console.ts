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

export const useConsole = create<ConsoleState>(set => ({
    lines: [],
    push: l => set(s => ({ lines: [...s.lines, l] })),
    clear: () => set({ lines: [] }),
}));

export const pushConsole = (line: ConsoleLine) => {
    useConsole.getState().push(line);
};
