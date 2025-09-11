/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { create } from "zustand";

type DraftsState = {
    drafts: Record<string, string>; // path -> text
    setDraft: (path: string, value: string) => void;
    clearDraft: (path: string) => void;
    getDraft: (path: string) => string | undefined;
    isDirty: (path: string, original?: string) => boolean;
};

export const useDrafts = create<DraftsState>((set, get) => ({
    drafts: {},
    setDraft: (path, value) => set(s => ({ drafts: { ...s.drafts, [path]: value } })),
    clearDraft: path =>
        set(s => {
            const next = { ...s.drafts };
            delete next[path];
            return { drafts: next };
        }),
    getDraft: path => get().drafts[path],
    isDirty: (path, original) => {
        const d = get().drafts[path];
        return d !== undefined && d !== original;
    },
}));
