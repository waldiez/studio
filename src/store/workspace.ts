/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import {
    createFile,
    createFolder,
    deleteFileOrFolder,
    fetchFiles,
    getFile,
    renameFileOrFolder,
    uploadFile,
} from "@/lib/http";
import type { GetFileResponse, PathInstancesResponse, PathItem } from "@/types/api";

import { create } from "zustand";

type WorkspaceState = {
    cwd: string;
    items: PathItem[];
    selected?: PathItem;
    fileCache: Record<string, GetFileResponse>;
    loading: boolean;
    error?: string;

    list: (parent?: string) => Promise<void>;
    select: (item: PathItem) => Promise<void>;
    refresh: () => Promise<void>;
    createFile: (parent?: string) => Promise<PathItem>;
    createFolder: (parent?: string) => Promise<PathItem>;
    rename: (oldPath: string, newPath: string) => Promise<void>;
    remove: (path: string) => Promise<void>;
    upload: (path: string, file: File) => Promise<void>;
};

export const useWorkspace = create<WorkspaceState>((set, get) => ({
    cwd: "/",
    items: [],
    fileCache: {},
    loading: false,

    list: async (parent = "/") => {
        set({ loading: true, error: undefined });
        try {
            const res: PathInstancesResponse = await fetchFiles(parent);
            set({ cwd: parent, items: res.items, loading: false });
        } catch (e: any) {
            set({ error: e.message ?? "Failed to list", loading: false });
        }
    },

    select: async item => {
        set({ selected: item });
        if (item.type === "folder") {
            return;
        }
        const cache = get().fileCache[item.path];
        if (cache) {
            return;
        }
        try {
            const f = await getFile(item.path);
            set(state => ({ fileCache: { ...state.fileCache, [item.path]: f } }));
        } catch (e: any) {
            set({ error: e.message ?? "Failed to load file" });
        }
    },

    refresh: async () => get().list(get().cwd),

    createFile: async (parent = "/") => {
        const f = await createFile(parent);
        await get().list(parent);
        return f;
    },

    createFolder: async (parent = "/") => {
        const f = await createFolder(parent);
        await get().list(parent);
        return f;
    },

    rename: async (oldPath, newPath) => {
        await renameFileOrFolder(oldPath, newPath);
        await get().list(get().cwd);
    },

    remove: async path => {
        await deleteFileOrFolder(path);
        await get().list(get().cwd);
    },

    upload: async (path, file) => {
        await uploadFile(path, file);
        await get().list(path);
    },
}));
