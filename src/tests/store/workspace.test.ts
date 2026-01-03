/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import { useWorkspace } from "@/store/workspace";
import type { GetFileResponse, PathInstancesResponse, PathItem } from "@/types/api";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the http lib
const mockFetchFiles = vi.fn();
const mockGetFile = vi.fn();
const mockCreateFile = vi.fn();
const mockCreateFolder = vi.fn();
const mockRenameFileOrFolder = vi.fn();
const mockDeleteFileOrFolder = vi.fn();
const mockUploadFile = vi.fn();

vi.mock("@/lib/http", () => ({
    fetchFiles: (...args: any[]) => mockFetchFiles(...args),
    getFile: (...args: any[]) => mockGetFile(...args),
    createFile: (...args: any[]) => mockCreateFile(...args),
    createFolder: (...args: any[]) => mockCreateFolder(...args),
    renameFileOrFolder: (...args: any[]) => mockRenameFileOrFolder(...args),
    deleteFileOrFolder: (...args: any[]) => mockDeleteFileOrFolder(...args),
    uploadFile: (...args: any[]) => mockUploadFile(...args),
}));

describe("useWorkspace store", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const { result } = renderHook(() => useWorkspace());
        act(() => {
            // Close all tabs to reset tab state
            result.current.closeAllTabs();
        });
    });

    it("should initialize with default state", () => {
        const { result } = renderHook(() => useWorkspace());

        expect(result.current.cwd).toBe("/");
        expect(result.current.items).toEqual([]);
        expect(result.current.openTabs).toEqual([]);
        expect(result.current.activeTabId).toBeNull();
        expect(result.current.fileCache).toEqual({});
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeUndefined();
    });

    it("should list files in directory", async () => {
        const mockResponse: PathInstancesResponse = {
            items: [
                { path: "/file1.txt", type: "file", name: "file1.txt" },
                { path: "/folder1", type: "folder", name: "folder1" },
            ],
        };

        mockFetchFiles.mockResolvedValue(mockResponse);

        const { result } = renderHook(() => useWorkspace());

        await act(async () => {
            await result.current.list("/");
        });

        expect(mockFetchFiles).toHaveBeenCalledWith("/");
        expect(result.current.cwd).toBe("/");
        expect(result.current.items).toEqual(mockResponse.items);
        expect(result.current.loading).toBe(false);
    });

    describe("Tab Management", () => {
        it("should open a file in a new tab", async () => {
            const fileItem: PathItem = {
                path: "/file1.txt",
                type: "file",
                name: "file1.txt",
            };

            const mockFileResponse: GetFileResponse = {
                path: "/file1.txt",
                content: "file content",
                kind: "text",
                mime: "text/plain",
            };

            mockGetFile.mockResolvedValue(mockFileResponse);

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(fileItem);
            });

            expect(result.current.openTabs).toHaveLength(1);
            expect(result.current.openTabs[0].item).toBe(fileItem);
            expect(result.current.activeTabId).toBe(result.current.openTabs[0].id);
            expect(mockGetFile).toHaveBeenCalledWith("/file1.txt");
            expect(result.current.fileCache["/file1.txt"]).toBe(mockFileResponse);
        });

        it("should not open folder as tab", async () => {
            const folderItem: PathItem = {
                path: "/folder1",
                type: "folder",
                name: "folder1",
            };

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(folderItem);
            });
            expect(result.current.openTabs).toHaveLength(0);
            expect(mockGetFile).not.toHaveBeenCalled();
        });

        it("should activate existing tab instead of creating duplicate", async () => {
            const fileItem: PathItem = {
                path: "/file1.txt",
                type: "file",
                name: "file1.txt",
            };

            mockGetFile.mockResolvedValue({
                path: "/file1.txt",
                content: "content",
                kind: "text",
                mime: "text/plain",
            });

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(fileItem);
            });

            const firstTabId = result.current.openTabs[0].id;

            await act(async () => {
                await result.current.openTab(fileItem);
            });

            expect(result.current.openTabs).toHaveLength(1);
            expect(result.current.activeTabId).toBe(firstTabId);
        });

        it("should open multiple different files", async () => {
            const file1: PathItem = { path: "/file1.txt", type: "file", name: "file1.txt" };
            const file2: PathItem = { path: "/file2.txt", type: "file", name: "file2.txt" };

            mockGetFile.mockResolvedValue({
                path: "/file1.txt",
                content: "content",
                kind: "text",
                mime: "text/plain",
            });

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(file1);
                await result.current.openTab(file2);
            });

            expect(result.current.openTabs).toHaveLength(2);
            expect(result.current.openTabs[0].item.path).toBe("/file1.txt");
            expect(result.current.openTabs[1].item.path).toBe("/file2.txt");
        });

        it("should close a tab", async () => {
            const fileItem: PathItem = { path: "/file1.txt", type: "file", name: "file1.txt" };

            mockGetFile.mockResolvedValue({
                path: "/file1.txt",
                content: "content",
                kind: "text",
                mime: "text/plain",
            });

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(fileItem);
            });

            const tabId = result.current.openTabs[0].id;

            act(() => {
                result.current.closeTab(tabId);
            });

            expect(result.current.openTabs).toHaveLength(0);
            expect(result.current.activeTabId).toBeNull();
        });

        it("should activate adjacent tab when closing active tab", async () => {
            const file1: PathItem = { path: "/file1.txt", type: "file", name: "file1.txt" };
            const file2: PathItem = { path: "/file2.txt", type: "file", name: "file2.txt" };
            const file3: PathItem = { path: "/file3.txt", type: "file", name: "file3.txt" };

            mockGetFile.mockResolvedValue({
                path: "/file1.txt",
                content: "content",
                kind: "text",
                mime: "text/plain",
            });

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(file1);
                await result.current.openTab(file2);
                await result.current.openTab(file3);
            });

            const tab2Id = result.current.openTabs[1].id;

            act(() => {
                result.current.setActiveTab(tab2Id);
                result.current.closeTab(tab2Id);
            });

            expect(result.current.openTabs).toHaveLength(2);
            expect(result.current.activeTabId).toBe(result.current.openTabs[1].id);
        });

        it("should set active tab", async () => {
            const file1: PathItem = { path: "/file1.txt", type: "file", name: "file1.txt" };
            const file2: PathItem = { path: "/file2.txt", type: "file", name: "file2.txt" };

            mockGetFile.mockResolvedValue({
                path: "/file1.txt",
                content: "content",
                kind: "text",
                mime: "text/plain",
            });

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(file1);
                await result.current.openTab(file2);
            });

            const tab1Id = result.current.openTabs[0].id;

            act(() => {
                result.current.setActiveTab(tab1Id);
            });

            expect(result.current.activeTabId).toBe(tab1Id);
        });

        it("should close all tabs", async () => {
            const file1: PathItem = { path: "/file1.txt", type: "file", name: "file1.txt" };
            const file2: PathItem = { path: "/file2.txt", type: "file", name: "file2.txt" };

            mockGetFile.mockResolvedValue({
                path: "/file1.txt",
                content: "content",
                kind: "text",
                mime: "text/plain",
            });

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(file1);
                await result.current.openTab(file2);
            });

            act(() => {
                result.current.closeAllTabs();
            });

            expect(result.current.openTabs).toHaveLength(0);
            expect(result.current.activeTabId).toBeNull();
        });

        it("should close other tabs", async () => {
            const file1: PathItem = { path: "/file1.txt", type: "file", name: "file1.txt" };
            const file2: PathItem = { path: "/file2.txt", type: "file", name: "file2.txt" };
            const file3: PathItem = { path: "/file3.txt", type: "file", name: "file3.txt" };

            mockGetFile.mockResolvedValue({
                path: "/file1.txt",
                content: "content",
                kind: "text",
                mime: "text/plain",
            });

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(file1);
                await result.current.openTab(file2);
                await result.current.openTab(file3);
            });

            const tab2Id = result.current.openTabs[1].id;

            act(() => {
                result.current.closeOtherTabs(tab2Id);
            });

            expect(result.current.openTabs).toHaveLength(1);
            expect(result.current.openTabs[0].id).toBe(tab2Id);
            expect(result.current.activeTabId).toBe(tab2Id);
        });

        it("should pin and unpin tabs", async () => {
            const fileItem: PathItem = { path: "/file1.txt", type: "file", name: "file1.txt" };

            mockGetFile.mockResolvedValue({
                path: "/file1.txt",
                content: "content",
                kind: "text",
                mime: "text/plain",
            });

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(fileItem);
            });

            const tabId = result.current.openTabs[0].id;

            act(() => {
                result.current.pinTab(tabId);
            });

            expect(result.current.openTabs[0].isPinned).toBe(true);

            act(() => {
                result.current.unpinTab(tabId);
            });

            expect(result.current.openTabs[0].isPinned).toBe(false);
        });

        it("should move tabs", async () => {
            const file1: PathItem = { path: "/file1.txt", type: "file", name: "file1.txt" };
            const file2: PathItem = { path: "/file2.txt", type: "file", name: "file2.txt" };
            const file3: PathItem = { path: "/file3.txt", type: "file", name: "file3.txt" };

            mockGetFile.mockResolvedValue({
                path: "/file1.txt",
                content: "content",
                kind: "text",
                mime: "text/plain",
            });

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(file1);
                await result.current.openTab(file2);
                await result.current.openTab(file3);
            });

            act(() => {
                result.current.moveTab(0, 2);
            });

            expect(result.current.openTabs[0].item.path).toBe("/file2.txt");
            expect(result.current.openTabs[1].item.path).toBe("/file3.txt");
            expect(result.current.openTabs[2].item.path).toBe("/file1.txt");
        });

        it("should get active tab", async () => {
            const fileItem: PathItem = { path: "/file1.txt", type: "file", name: "file1.txt" };

            mockGetFile.mockResolvedValue({
                path: "/file1.txt",
                content: "content",
                kind: "text",
                mime: "text/plain",
            });

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(fileItem);
            });

            const activeTab = result.current.getActiveTab();

            expect(activeTab).toBeDefined();
            expect(activeTab?.item.path).toBe("/file1.txt");
        });

        it("should get tab by path", async () => {
            const fileItem: PathItem = { path: "/file1.txt", type: "file", name: "file1.txt" };

            mockGetFile.mockResolvedValue({
                path: "/file1.txt",
                content: "content",
                kind: "text",
                mime: "text/plain",
            });

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(fileItem);
            });

            const tab = result.current.getTabByPath("/file1.txt");

            expect(tab).toBeDefined();
            expect(tab?.item.path).toBe("/file1.txt");
        });

        it("should not reload cached file content when opening tab", async () => {
            const fileItem: PathItem = {
                path: "/cached.txt",
                type: "file",
                name: "cached.txt",
            };

            const { result } = renderHook(() => useWorkspace());

            // Set up cache
            act(() => {
                result.current.fileCache["/cached.txt"] = {
                    path: "/cached.txt",
                    content: "cached",
                    kind: "text",
                    mime: "text/plain",
                };
            });

            await act(async () => {
                await result.current.openTab(fileItem);
            });

            expect(mockGetFile).not.toHaveBeenCalled();
            expect(result.current.openTabs).toHaveLength(1);
        });

        it("should handle file loading errors when opening tab", async () => {
            const fileItem: PathItem = {
                path: "/error.txt",
                type: "file",
                name: "error.txt",
            };

            const error = new Error("File not found");
            mockGetFile.mockRejectedValue(error);

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(fileItem);
            });

            expect(result.current.error).toBe("File not found");
            expect(result.current.openTabs).toHaveLength(1); // Tab still created
        });
    });

    describe("File Operations with Tabs", () => {
        it("should update tab paths when renaming", async () => {
            const fileItem: PathItem = { path: "/old.txt", type: "file", name: "old.txt" };

            mockGetFile.mockResolvedValue({
                path: "/old.txt",
                content: "content",
                kind: "text",
                mime: "text/plain",
            });

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(fileItem);
            });

            act(() => {
                result.current.cwd = "/";
            });

            mockRenameFileOrFolder.mockResolvedValue(undefined);
            mockFetchFiles.mockResolvedValue({ items: [] });

            await act(async () => {
                await result.current.rename("/old.txt", "/new.txt");
            });

            expect(result.current.openTabs[0].item.path).toBe("/new.txt");
            expect(result.current.openTabs[0].item.name).toBe("new.txt");
        });

        it("should close tab when file is deleted", async () => {
            const fileItem: PathItem = { path: "/delete-me.txt", type: "file", name: "delete-me.txt" };

            mockGetFile.mockResolvedValue({
                path: "/delete-me.txt",
                content: "content",
                kind: "text",
                mime: "text/plain",
            });

            const { result } = renderHook(() => useWorkspace());

            await act(async () => {
                await result.current.openTab(fileItem);
            });

            act(() => {
                result.current.cwd = "/";
            });

            mockDeleteFileOrFolder.mockResolvedValue(undefined);
            mockFetchFiles.mockResolvedValue({ items: [] });

            await act(async () => {
                await result.current.remove("/delete-me.txt");
            });

            expect(result.current.openTabs).toHaveLength(0);
            expect(result.current.activeTabId).toBeNull();
        });
    });

    it("should create a file and refresh", async () => {
        const newFile: PathItem = {
            path: "/test/newfile.txt",
            type: "file",
            name: "newfile.txt",
        };

        mockCreateFile.mockResolvedValue(newFile);
        mockFetchFiles.mockResolvedValue({ items: [newFile] });

        const { result } = renderHook(() => useWorkspace());

        await act(async () => {
            await result.current.createFile("/test");
        });

        expect(mockCreateFile).toHaveBeenCalledWith("/test");
        expect(mockFetchFiles).toHaveBeenCalledWith("/test");
    });

    it("should handle errors gracefully", async () => {
        const error = new Error("Network error");
        mockFetchFiles.mockRejectedValue(error);

        const { result } = renderHook(() => useWorkspace());

        await act(async () => {
            await result.current.list("/test");
        });

        expect(result.current.error).toBe("Network error");
        expect(result.current.loading).toBe(false);
    });

    it("should handle errors without message", async () => {
        mockFetchFiles.mockRejectedValue(new Error("Failed to list"));

        const { result } = renderHook(() => useWorkspace());

        await act(async () => {
            await result.current.list("/test");
        });

        expect(result.current.error).toBe("Failed to list");
    });

    it("should refresh current directory", async () => {
        const { result } = renderHook(() => useWorkspace());

        act(() => {
            result.current.cwd = "/test";
        });

        mockFetchFiles.mockResolvedValue({ items: [] });

        await act(async () => {
            await result.current.refresh();
        });

        expect(mockFetchFiles).toHaveBeenCalledWith("/test");
    });

    it("should create folder and refresh", async () => {
        const newFolder: PathItem = {
            path: "/test/new folder",
            type: "folder",
            name: "new folder",
        };

        mockCreateFolder.mockResolvedValue(newFolder);
        mockFetchFiles.mockResolvedValue({ items: [newFolder] });

        const { result } = renderHook(() => useWorkspace());

        await act(async () => {
            await result.current.createFolder("/test");
        });

        expect(mockCreateFolder).toHaveBeenCalledWith("/test");
        expect(mockFetchFiles).toHaveBeenCalledWith("/test");
    });

    it("should upload and refresh", async () => {
        const file = new File(["content"], "upload.txt", { type: "text/plain" });
        const { result } = renderHook(() => useWorkspace());

        mockUploadFile.mockResolvedValue(undefined);
        mockFetchFiles.mockResolvedValue({ items: [] });

        await act(async () => {
            await result.current.upload("/test", file);
        });

        expect(mockUploadFile).toHaveBeenCalledWith("/test", file);
        expect(mockFetchFiles).toHaveBeenCalledWith("/test");
    });
});
