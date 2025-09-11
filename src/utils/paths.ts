/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */

// ipynb not yet
// const RUNNABLE_EXTS = new Set<string>([".py", ".ipynb", ".waldiez"]);
const RUNNABLE_EXTS = new Set<string>([".py", ".waldiez"]);

export const extOf = (name: string) => {
    if (name.startsWith(".")) {
        return "";
    }
    const i = name.lastIndexOf(".");
    return i >= 0 ? name.slice(i).toLowerCase() : "";
};

export const dirname = (p: string) => {
    const parts = p.split("/").filter(Boolean);
    parts.pop();
    return parts.length ? parts.join("/") : "";
};

export const isRunnable = (p?: string | null): boolean => {
    if (!p) {
        return false;
    }
    return RUNNABLE_EXTS.has(extOf(p));
};

export function normalizePath(p: string): string {
    return p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}

export function equalPaths(a?: string | null, b?: string | null): boolean {
    if (!a || !b) {
        return false;
    }
    return normalizePath(a) === normalizePath(b);
}

export const isWaldiez = (p: string) => extOf(p) === ".waldiez";
