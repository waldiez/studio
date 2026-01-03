/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
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

type TabItem = {
    id: string; // unique identifier for the tab
    item: PathItem; // the file/folder item
    isPinned?: boolean; // optional: pinned tabs stay open
};

type WorkspaceState = {
    cwd: string;
    items: PathItem[];
    openTabs: TabItem[];
    activeTabId: string | null;
    fileCache: Record<string, GetFileResponse>;
    loading: boolean;
    error?: string;

    clearCache: () => void;
    setFileCache: (file: { item: PathItem; mime: string; content: string }) => void;
    list: (parent?: string) => Promise<void>;
    refresh: () => Promise<void>;
    createFile: (parent?: string) => Promise<PathItem>;
    createFolder: (parent?: string) => Promise<PathItem>;
    rename: (oldPath: string, newPath: string) => Promise<void>;
    remove: (path: string) => Promise<void>;
    upload: (path: string, file: File) => Promise<void>;
    // Tab operations
    openTab: (item: PathItem) => Promise<void>;
    closeTab: (tabId: string) => void;
    closeAllTabs: () => void;
    closeOtherTabs: (tabId: string) => void;
    setActiveTab: (tabId: string) => void;
    pinTab: (tabId: string) => void;
    unpinTab: (tabId: string) => void;
    moveTab: (fromIndex: number, toIndex: number) => void;
    // Helpers
    getActiveTab: () => TabItem | undefined;
    getTabByPath: (path: string) => TabItem | undefined;
};

const generateTabId = (path: string) => `tab-${path}-${Date.now()}`;

export const useWorkspace = create<WorkspaceState>((set, get) => ({
    cwd: "/",
    items: [],
    openTabs: [],
    activeTabId: null,
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

    refresh: async () => get().list(get().cwd),

    clearCache: () => set({ fileCache: {} }),

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

        // Update tabs with renamed paths
        set(state => ({
            openTabs: state.openTabs.map(tab =>
                tab.item.path === oldPath
                    ? {
                          ...tab,
                          item: { ...tab.item, path: newPath, name: newPath.split("/").pop() || newPath },
                      }
                    : tab,
            ),
        }));

        await get().list(get().cwd);
    },

    remove: async path => {
        await deleteFileOrFolder(path);

        // Close tabs for deleted files
        set(state => ({
            openTabs: state.openTabs.filter(tab => tab.item.path !== path),
            activeTabId: state.openTabs.find(tab => tab.item.path !== path)?.id || null,
        }));

        await get().list(get().cwd);
    },

    upload: async (path, file) => {
        await uploadFile(path, file);
        await get().list(path);
    },

    // Tab operations
    openTab: async (item: PathItem) => {
        if (item.type === "folder") {
            return; // Don't open folders as tabs
        }

        const state = get();
        const existingTab = state.openTabs.find(tab => tab.item.path === item.path);

        if (existingTab) {
            // Tab already open, just activate it
            set({ activeTabId: existingTab.id });
            return;
        }

        // Create new tab
        const newTab: TabItem = {
            id: generateTabId(item.path),
            item,
            isPinned: false,
        };

        set(state => ({
            openTabs: [...state.openTabs, newTab],
            activeTabId: newTab.id,
        }));

        // Load file content if not cached
        const cache = get().fileCache[item.path];
        if (!cache) {
            try {
                const f = await getFile(item.path);
                set(state => ({
                    fileCache: { ...state.fileCache, [item.path]: f },
                }));
            } catch (e: any) {
                set({ error: e.message ?? "Failed to load file" });
            }
        }
    },

    setFileCache: (file: { item: PathItem; mime: string; content: string }) => {
        const { item, mime, content } = file;
        set(state => ({
            fileCache: {
                ...state.fileCache,
                [item.path]: { kind: "text", content, mime, path: item.path },
            },
        }));
    },

    closeTab: (tabId: string) => {
        set(state => {
            const tabIndex = state.openTabs.findIndex(t => t.id === tabId);
            if (tabIndex === -1) {
                return state;
            }

            const newTabs = state.openTabs.filter(t => t.id !== tabId);

            // If closing active tab, activate adjacent tab
            let newActiveId = state.activeTabId;
            if (state.activeTabId === tabId) {
                if (newTabs.length > 0) {
                    // Activate tab to the right, or left if closing rightmost
                    const newIndex = Math.min(tabIndex, newTabs.length - 1);
                    newActiveId = newTabs[newIndex]?.id || null;
                } else {
                    newActiveId = null;
                }
            }

            return {
                openTabs: newTabs,
                activeTabId: newActiveId,
            };
        });
    },

    closeAllTabs: () => {
        set({ openTabs: [], activeTabId: null });
    },

    closeOtherTabs: (tabId: string) => {
        set(state => {
            const tab = state.openTabs.find(t => t.id === tabId);
            if (!tab) {
                return state;
            }

            return {
                openTabs: [tab],
                activeTabId: tabId,
            };
        });
    },

    setActiveTab: (tabId: string) => {
        const tab = get().openTabs.find(t => t.id === tabId);
        if (tab) {
            set({ activeTabId: tabId });
        }
    },

    pinTab: (tabId: string) => {
        set(state => ({
            openTabs: state.openTabs.map(tab => (tab.id === tabId ? { ...tab, isPinned: true } : tab)),
        }));
    },

    unpinTab: (tabId: string) => {
        set(state => ({
            openTabs: state.openTabs.map(tab => (tab.id === tabId ? { ...tab, isPinned: false } : tab)),
        }));
    },

    moveTab: (fromIndex: number, toIndex: number) => {
        set(state => {
            const newTabs = [...state.openTabs];
            const [movedTab] = newTabs.splice(fromIndex, 1);
            newTabs.splice(toIndex, 0, movedTab);
            return { openTabs: newTabs };
        });
    },

    // Helpers
    getActiveTab: () => {
        const state = get();
        return state.openTabs.find(tab => tab.id === state.activeTabId);
    },

    getTabByPath: (path: string) => {
        return get().openTabs.find(tab => tab.item.path === path);
    },
}));
