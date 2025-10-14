/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { onWorkspaceChanged } from "@/lib/events";
import type { PathItem } from "@/types/api";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useFileSystem() {
    const [cwd, setCwd] = useState<string>("/");
    const [items, setItems] = useState<PathItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selection, setSelection] = useState<PathItem | null>(null);

    // keep latest cwd in a ref for stable callbacks
    const cwdRef = useRef(cwd);
    useEffect(() => {
        cwdRef.current = cwd;
    }, [cwd]);

    async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
        const r = await fetch(url, { headers: { accept: "application/json" }, ...init });
        if (!r.ok) {
            throw new Error((await r.text()) || `${r.status} ${r.statusText}`);
        }
        return r.json();
    }

    // list(): reads default target from cwdRef, not from closure
    const list = useCallback(
        async (parent?: string) => {
            const target = parent ?? cwdRef.current ?? "/";
            try {
                setLoading(true);
                setError(null);
                const url = new URL("/api/workspace", location.origin);
                if (!["", "/"].includes(target)) {
                    url.searchParams.set("parent", target);
                }
                const data = await getJSON<{ items: PathItem[] }>(url.toString());
                setItems(data.items);
                // only update cwd if it actually changed (avoids extra renders)
                setCwd(prev => (prev === (target || "/") ? prev : target || "/"));
            } catch (e: any) {
                setError(e?.message ?? "Failed to list");
            } finally {
                setLoading(false);
            }
        },
        [], //
    );

    const goTo = useCallback(async (path: string) => list(path), [list]);

    const goUp = useCallback(async () => {
        const cur = cwdRef.current;
        if (cur === "/" || cur === "") {
            return;
        }
        const parts = cur.split("/").filter(Boolean);
        parts.pop();
        const next = parts.length ? `/${parts.join("/")}` : "/";
        await list(next);
    }, [list]);

    // actions unchanged, but they now call stable list()
    const createFolder = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const r = await fetch("/api/workspace", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ type: "folder", parent: cwdRef.current }),
            });
            if (!r.ok) {
                throw new Error(await r.text());
            }
            await list(cwdRef.current);
        } catch (e: any) {
            setError(e?.message ?? "Failed to create folder");
        } finally {
            setLoading(false);
        }
    }, [list]);

    const createFile = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const r = await fetch("/api/workspace", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ type: "file", parent: cwdRef.current }),
            });
            if (!r.ok) {
                throw new Error(await r.text());
            }
            await list(cwdRef.current);
        } catch (e: any) {
            setError(e?.message ?? "Failed to create file");
        } finally {
            setLoading(false);
        }
    }, [list]);

    const upload = useCallback(
        async (file: File) => {
            try {
                setLoading(true);
                setError(null);
                const form = new FormData();
                form.append("file", file);
                form.append("path", cwdRef.current);
                const r = await fetch("/api/workspace/upload", { method: "POST", body: form });
                if (!r.ok) {
                    throw new Error(await r.text());
                }
                await list(cwdRef.current);
            } catch (e: any) {
                setError(e?.message ?? "Failed to upload");
            } finally {
                setLoading(false);
            }
        },
        [list],
    );

    const rename = useCallback(
        async (oldPath: string, newPath: string) => {
            try {
                setLoading(true);
                setError(null);
                const r = await fetch("/api/workspace/rename", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
                });
                if (!r.ok) {
                    throw new Error(await r.text());
                }
                await list(cwdRef.current);
            } catch (e: any) {
                setError(e?.message ?? "Failed to rename");
            } finally {
                setLoading(false);
            }
        },
        [list],
    );

    const remove = useCallback(
        async (path: string) => {
            try {
                setLoading(true);
                setError(null);
                const url = new URL("/api/workspace", location.origin);
                url.searchParams.set("path", path);
                const r = await fetch(url.toString(), { method: "DELETE" });
                if (!r.ok) {
                    throw new Error(await r.text());
                }
                await list(cwdRef.current);
            } catch (e: any) {
                setError(e?.message ?? "Failed to delete");
            } finally {
                setLoading(false);
            }
        },
        [list],
    );

    // Initial load (stable list)
    useEffect(() => {
        void list("/");
    }, [list]);

    // Workspace change subscription — refresh only the indicated parent,
    // and only if it matches the *current* folder (from ref).
    useEffect(() => {
        const off = onWorkspaceChanged(({ parent }) => {
            if (!parent) {
                return;
            }
            // normalize leading slash
            const normalized = parent.startsWith("/") ? parent : `/${parent}`;
            if (normalized === cwdRef.current) {
                void list(normalized);
            }
        });
        return off;
    }, [list]);

    const breadcrumbs = useMemo(() => {
        const parts = cwd.split("/").filter(Boolean);
        const acc: { label: string; path: string }[] = [{ label: "root", path: "/" }];
        const cur: string[] = [];
        parts.forEach(p => {
            cur.push(p);
            acc.push({ label: p, path: `/${cur.join("/")}` });
        });
        return acc;
    }, [cwd]);

    return {
        cwd,
        items,
        loading,
        error,
        selection,
        setSelection,
        list,
        goTo,
        goUp,
        createFolder,
        createFile,
        upload,
        rename,
        remove,
        breadcrumbs,
    };
}
