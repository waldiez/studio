/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
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
    });

    it("should initialize with default state", () => {
        const { result } = renderHook(() => useWorkspace());

        expect(result.current.cwd).toBe("/");
        expect(result.current.items).toEqual([]);
        expect(result.current.selected).toBeUndefined();
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

    it("should select a file and load its content", async () => {
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
            await result.current.select(fileItem);
        });

        expect(result.current.selected).toBe(fileItem);
        expect(mockGetFile).toHaveBeenCalledWith("/file1.txt");
        expect(result.current.fileCache["/file1.txt"]).toBe(mockFileResponse);
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

    it("should select folder without loading content", async () => {
        const folderItem: PathItem = {
            path: "/folder1",
            type: "folder",
            name: "folder1",
        };

        const { result } = renderHook(() => useWorkspace());

        await act(async () => {
            await result.current.select(folderItem);
        });

        expect(result.current.selected).toBe(folderItem);
        expect(mockGetFile).not.toHaveBeenCalled();
    });

    it("should not reload cached file content", async () => {
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
            await result.current.select(fileItem);
        });

        expect(mockGetFile).not.toHaveBeenCalled();
    });

    it("should handle file loading errors", async () => {
        const fileItem: PathItem = {
            path: "/error.txt",
            type: "file",
            name: "error.txt",
        };

        const error = new Error("File not found");
        mockGetFile.mockRejectedValue(error);

        const { result } = renderHook(() => useWorkspace());

        await act(async () => {
            await result.current.select(fileItem);
        });

        expect(result.current.error).toBe("File not found");
    });

    it("should handle file loading errors without message", async () => {
        const fileItem: PathItem = {
            path: "/error.txt",
            type: "file",
            name: "error.txt",
        };

        mockGetFile.mockRejectedValue(new Error("Failed to load file"));

        const { result } = renderHook(() => useWorkspace());

        await act(async () => {
            await result.current.select(fileItem);
        });

        expect(result.current.error).toBe("Failed to load file");
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

    it("should rename and refresh", async () => {
        const { result } = renderHook(() => useWorkspace());

        act(() => {
            result.current.cwd = "/test";
        });

        mockRenameFileOrFolder.mockResolvedValue(undefined);
        mockFetchFiles.mockResolvedValue({ items: [] });

        await act(async () => {
            await result.current.rename("/test/old.txt", "/test/new.txt");
        });

        expect(mockRenameFileOrFolder).toHaveBeenCalledWith("/test/old.txt", "/test/new.txt");
        expect(mockFetchFiles).toHaveBeenCalledWith("/test");
    });

    it("should remove and refresh", async () => {
        const { result } = renderHook(() => useWorkspace());

        act(() => {
            result.current.cwd = "/test";
        });

        mockDeleteFileOrFolder.mockResolvedValue(undefined);
        mockFetchFiles.mockResolvedValue({ items: [] });

        await act(async () => {
            await result.current.remove("/test/file.txt");
        });

        expect(mockDeleteFileOrFolder).toHaveBeenCalledWith("/test/file.txt");
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
