/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
/* eslint-disable max-nested-callbacks */
import { describe, expect, it, vi } from "vitest";

import { apiPrefix } from "@/env";
import axiosInstance from "@/lib/axiosInstance";
import * as fileBrowserService from "@/lib/http";
import type { GetFileBinary, GetFileText } from "@/types/api";

vi.mock("@/lib/axiosInstance", () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
    },
}));

describe("fileBrowserService", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("fetchFiles calls axiosInstance.get with correct parameters", async () => {
        const mockResponse = { data: [] };
        (axiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const parent = "/test";
        const result = await fileBrowserService.fetchFiles(parent);

        expect(axiosInstance.get).toHaveBeenCalledWith("/workspace", {
            params: { parent },
        });
        expect(result).toEqual(mockResponse.data);
    });

    it("createFolder calls axiosInstance.post with correct parameters", async () => {
        const mockResponse = { data: { id: 1, name: "New Folder" } };
        (axiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const parent = "/";
        const result = await fileBrowserService.createFolder(parent);

        expect(axiosInstance.post).toHaveBeenCalledWith("/workspace", {
            type: "folder",
            parent,
        });
        expect(result).toEqual(mockResponse.data);
    });

    it("createFile calls axiosInstance.post with correct parameters", async () => {
        const mockResponse = { data: { id: 1, name: "New File" } };
        (axiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const parent = "/";
        const result = await fileBrowserService.createFile(parent);

        expect(axiosInstance.post).toHaveBeenCalledWith("/workspace", {
            type: "file",
            parent,
        });
        expect(result).toEqual(mockResponse.data);
    });

    it("uploadFile calls axiosInstance.post with correct parameters", async () => {
        const mockResponse = { data: { id: 1, name: "Uploaded File" } };
        (axiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const path = "/";
        const file = new File(["test"], "test.txt", { type: "text/plain" });
        const result = await fileBrowserService.uploadFile(path, file);

        expect(axiosInstance.post).toHaveBeenCalledWith("/workspace/upload", expect.any(FormData), {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: expect.any(Function),
            signal: undefined,
        });
        expect(result).toEqual(mockResponse.data);
    });

    it("deleteFileOrFolder calls axiosInstance.delete with correct parameters", async () => {
        const mockResponse = { data: { message: "Deleted successfully" } };
        (axiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const path = "/test";
        const result = await fileBrowserService.deleteFileOrFolder(path);

        expect(axiosInstance.delete).toHaveBeenCalledWith(`/workspace?path=${encodeURIComponent(path)}`);
        expect(result).toEqual(mockResponse.data);
    });

    it("renameFileOrFolder calls axiosInstance.post with correct parameters", async () => {
        const mockResponse = { data: { id: 1, name: "Renamed Item" } };
        (axiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const oldPath = "/old";
        const newPath = "/new";
        const result = await fileBrowserService.renameFileOrFolder(oldPath, newPath);

        expect(axiosInstance.post).toHaveBeenCalledWith(
            "/workspace/rename",
            { old_path: oldPath, new_path: newPath },
            { headers: { "Content-Type": "application/json" } },
        );
        expect(result).toEqual(mockResponse.data);
    });

    it("downloadFileOrFolder creates a download link", async () => {
        const mockBlob = new Blob(["test content"]);
        const mockResponse = { data: mockBlob };
        (axiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const path = "/test";
        const type = "folder";

        const createElementSpy = vi.spyOn(document, "createElement");
        const revokeObjectURLSpy = vi.spyOn(global.URL, "revokeObjectURL");

        await fileBrowserService.downloadFileOrFolder(path, type);

        expect(axiosInstance.get).toHaveBeenCalledWith(
            `/workspace/download?path=${encodeURIComponent(path)}`,
            { responseType: "blob" },
        );
        expect(createElementSpy).toHaveBeenCalledWith("a");
        expect(revokeObjectURLSpy).toHaveBeenCalled();
    });

    describe("saveTextFile", () => {
        it("should save text file with correct payload", async () => {
            const mockResponse = { data: {} };
            (axiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

            await fileBrowserService.saveTextFile("/test/file.txt", "file content");

            expect(axiosInstance.post).toHaveBeenCalledWith("/workspace/save", {
                path: "/test/file.txt",
                content: "file content",
            });
        });

        it("should handle save errors", async () => {
            const error = new Error("Save failed");
            (axiosInstance.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

            await expect(fileBrowserService.saveTextFile("/test/file.txt", "content"))
                .rejects.toThrow("Save failed");
        });

        it("should save empty content", async () => {
            const mockResponse = { data: {} };
            (axiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

            await fileBrowserService.saveTextFile("/test/empty.txt", "");

            expect(axiosInstance.post).toHaveBeenCalledWith("/workspace/save", {
                path: "/test/empty.txt",
                content: "",
            });
        });
    });

    describe("getFile", () => {
        describe("textual files", () => {
            it("should fetch Python files as text", async () => {
                const mockResponse = {
                    status: 200,
                    data: {
                        path: "/test/script.py",
                        mime: "text/x-python",
                        content: "print('hello')",
                    },
                };
                (axiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

                const result = await fileBrowserService.getFile("/test/script.py");

                expect(axiosInstance.get).toHaveBeenCalledWith("/workspace/get", {
                    params: { path: "/test/script.py" },
                    responseType: "json",
                    validateStatus: expect.any(Function),
                });
                expect(result).toEqual({
                    kind: "text",
                    path: "/test/script.py",
                    mime: "text/x-python",
                    content: "print('hello')",
                });
            });

            it("should fetch JSON files as text", async () => {
                const mockResponse = {
                    status: 200,
                    data: {
                        path: "/test/config.json",
                        mime: "application/json",
                        content: '{"key": "value"}',
                    },
                };
                (axiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

                const result = await fileBrowserService.getFile("/test/config.json") as GetFileText

                expect(result.kind).toBe("text");
                expect(result.content).toBe('{"key": "value"}');
            });

            it("should handle textual file fetch errors", async () => {
                const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
                (axiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                    status: 404,
                    statusText: "Not Found",
                    data: { detail: "File not found" },
                });

                await expect(fileBrowserService.getFile("/test/missing.py"))
                    .rejects.toThrow("File not found");
                consoleSpy.mockRestore();
            });

            it("should handle textual file fetch errors without detail", async () => {
                const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
                (axiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                    status: 500,
                    statusText: "Internal Server Error",
                    data: {},
                });

                await expect(fileBrowserService.getFile("/test/error.py"))
                    .rejects.toThrow("Internal Server Error");
                consoleSpy.mockRestore();
            });

            it("should handle network errors for textual files", async () => {
                const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
                const error = new Error("Network error");
                (axiosInstance.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

                await expect(fileBrowserService.getFile("/test/script.py"))
                    .rejects.toThrow("Network error");
                consoleSpy.mockRestore();
            });
        });

        describe("binary files", () => {
            it("should return binary response for image files", async () => {
                const result = await fileBrowserService.getFile("/test/image.png");

                expect(result).toEqual({
                    kind: "binary",
                    path: "/test/image.png",
                    mime: "image/png",
                    // cspell: disable-next-line
                    url: `${apiPrefix}/workspace/get?path=%2Ftest%2Fimage.png`,
                    filename: "image.png",
                });
                expect(axiosInstance.get).not.toHaveBeenCalled();
            });

            it("should return binary response for video files", async () => {
                const result = await fileBrowserService.getFile("/test/video.mp4");

                expect(result).toEqual({
                    kind: "binary",
                    path: "/test/video.mp4",
                    mime: "video/mp4",
                    // cspell: disable-next-line
                    url: `${apiPrefix}/workspace/get?path=%2Ftest%2Fvideo.mp4`,
                    filename: "video.mp4",
                });
            });

            it("should handle files with complex paths", async () => {
                const result = await fileBrowserService.getFile("/path/to/deep/folder/image.jpg") as GetFileBinary
                expect(result.filename).toBe("image.jpg");
                // cspell: disable-next-line
                expect(result.url).toBe(`${apiPrefix}/workspace/get?path=%2Fpath%2Fto%2Fdeep%2Ffolder%2Fimage.jpg`);
            });

            it("should handle files without proper filename", async () => {
                const result = await fileBrowserService.getFile("/test/") as GetFileBinary

                expect(result.filename).toBe("download");
            });

            it("should handle unknown binary extensions", async () => {
                const result = await fileBrowserService.getFile("/test/file.bin");

                expect(result).toEqual({
                    kind: "binary",
                    path: "/test/file.bin",
                    mime: "application/octet-stream",
                    // cspell: disable-next-line
                    url: `${apiPrefix}/workspace/get?path=%2Ftest%2Ffile.bin`,
                    filename: "file.bin",
                });
            });
        });

        describe("case sensitivity", () => {
            it("should handle uppercase extensions as textual", async () => {
                (axiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                    status: 200,
                    data: { path: "/test/SCRIPT.PY", mime: "text/plain", content: "content" },
                });

                const result = await fileBrowserService.getFile("/test/SCRIPT.PY");
                expect(result.kind).toBe("text");
            });

            it("should handle uppercase extensions as binary", async () => {
                const result = await fileBrowserService.getFile("/test/IMAGE.PNG");
                expect(result.kind).toBe("binary");
                expect(result.mime).toBe("image/png");
            });
        });
    });
});
