/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { apiPrefix } from "@/env";
import { useFileSystem } from "@/features/explorer/hooks/useFileSystem";
import { onWorkspaceChanged } from "@/lib/events";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock events
vi.mock("@/lib/events", () => ({
    onWorkspaceChanged: vi.fn(() => () => {}),
}));

describe("useFileSystem", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ items: [] }),
            text: () => Promise.resolve(""),
        });
    });

    it("initializes with default state", async () => {
        const { result } = renderHook(() => useFileSystem());

        expect(result.current.cwd).toBe("/");
        expect(result.current.items).toEqual([]);
        expect(result.current.loading).toBe(true); // Initially loading
        expect(result.current.error).toBeNull();
        expect(result.current.selection).toBeNull();

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
    });

    it("loads initial directory on mount", async () => {
        renderHook(() => useFileSystem());

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(`http://localhost:3000${apiPrefix}/workspace`, {
                headers: { accept: "application/json" },
            });
        });
    });

    it("lists items in directory", async () => {
        const mockItems = [
            { type: "folder", name: "src", path: "src" },
            { type: "file", name: "README.md", path: "README.md" },
        ];

        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ items: mockItems }),
        });

        const { result } = renderHook(() => useFileSystem());

        await waitFor(() => {
            expect(result.current.items).toEqual(mockItems);
            expect(result.current.loading).toBe(false);
        });
    });

    it("handles API errors", async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 404,
            statusText: "Not Found",
            text: () => Promise.resolve("Directory not found"),
        });

        const { result } = renderHook(() => useFileSystem());

        await waitFor(() => {
            expect(result.current.error).toBe("Directory not found");
            expect(result.current.loading).toBe(false);
        });
    });

    it("navigates to directory", async () => {
        const { result } = renderHook(() => useFileSystem());

        await act(async () => {
            await result.current.goTo("/src");
        });

        // cspell: disable-next-line
        expect(mockFetch).toHaveBeenCalledWith(`http://localhost:3000${apiPrefix}/workspace?parent=%2Fsrc`, {
            headers: { accept: "application/json" },
        });
    });

    it("navigates up directory", async () => {
        const { result } = renderHook(() => useFileSystem());

        // First navigate to a subdirectory
        await act(async () => {
            await result.current.goTo("/src/components");
        });

        await act(async () => {
            await result.current.goUp();
        });

        // cspell: disable-next-line
        expect(mockFetch).toHaveBeenLastCalledWith(
            `http://localhost:3000${apiPrefix}/workspace?parent=%2Fsrc`,
            {
                headers: { accept: "application/json" },
            },
        );
    });

    it("does not navigate up from root", async () => {
        const { result } = renderHook(() => useFileSystem());

        const initialCallCount = mockFetch.mock.calls.length;

        await act(async () => {
            await result.current.goUp();
        });

        // Should not make additional API calls
        expect(mockFetch.mock.calls.length).toBe(initialCallCount);
    });

    it("creates folder", async () => {
        mockFetch.mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useFileSystem());

        await act(async () => {
            await result.current.createFolder();
        });

        expect(mockFetch).toHaveBeenCalledWith(`http://localhost:3000${apiPrefix}/workspace`, {
            headers: { accept: "application/json" },
        });
    });

    it("creates file", async () => {
        mockFetch.mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useFileSystem());

        await act(async () => {
            await result.current.createFile();
        });

        expect(mockFetch).toHaveBeenCalledWith(`${apiPrefix}/workspace`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "file", parent: "/" }),
        });
    });

    it("uploads file", async () => {
        mockFetch.mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useFileSystem());
        const mockFile = new File(["content"], "test.txt", { type: "text/plain" });

        await act(async () => {
            await result.current.upload(mockFile);
        });

        expect(mockFetch).toHaveBeenCalledWith(`${apiPrefix}/workspace/upload`, {
            method: "POST",
            body: expect.any(FormData),
        });
    });

    it("renames item", async () => {
        mockFetch.mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useFileSystem());

        await act(async () => {
            await result.current.rename("old-name.txt", "new-name.txt");
        });

        expect(mockFetch).toHaveBeenCalledWith(`${apiPrefix}/workspace/rename`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ old_path: "old-name.txt", new_path: "new-name.txt" }),
        });
    });

    it("removes item", async () => {
        mockFetch.mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useFileSystem());

        await act(async () => {
            await result.current.remove("file-to-delete.txt");
        });

        expect(mockFetch).toHaveBeenCalledWith(
            `http://localhost:3000${apiPrefix}/workspace?path=file-to-delete.txt`,
            {
                method: "DELETE",
            },
        );
    });

    it("manages selection state", () => {
        const { result } = renderHook(() => useFileSystem());

        const mockItem = { type: "file" as const, name: "test.txt", path: "test.txt" };

        act(() => {
            result.current.setSelection(mockItem);
        });

        expect(result.current.selection).toEqual(mockItem);

        act(() => {
            result.current.setSelection(null);
        });

        expect(result.current.selection).toBeNull();
    });

    it("generates breadcrumbs correctly", async () => {
        const { result } = renderHook(() => useFileSystem());

        // Test root breadcrumbs
        expect(result.current.breadcrumbs).toEqual([{ label: "root", path: "/" }]);

        // Navigate to nested path
        await act(async () => {
            await result.current.goTo("/src/components");
        });

        await waitFor(() => {
            expect(result.current.breadcrumbs).toEqual([
                { label: "root", path: "/" },
                { label: "src", path: "/src" },
                { label: "components", path: "/src/components" },
            ]);
        });
    });

    it("subscribes to workspace changes", () => {
        renderHook(() => useFileSystem());

        expect(onWorkspaceChanged).toHaveBeenCalledWith(expect.any(Function));
    });

    it("refreshes on workspace change for current directory", async () => {
        let changeHandler: (event: any) => void;
        vi.mocked(onWorkspaceChanged).mockImplementation(handler => {
            changeHandler = handler;
            return () => {};
        });

        const { result } = renderHook(() => useFileSystem());

        // Wait for initial load
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        const initialCallCount = mockFetch.mock.calls.length;

        // Trigger workspace change for current directory
        act(() => {
            changeHandler!({ parent: "/" });
        });

        await waitFor(() => {
            expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
    });

    it("ignores workspace changes for other directories", async () => {
        let changeHandler: (event: any) => void;
        vi.mocked(onWorkspaceChanged).mockImplementation(handler => {
            changeHandler = handler;
            return () => {};
        });

        const { result } = renderHook(() => useFileSystem());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        const initialCallCount = mockFetch.mock.calls.length;

        // Trigger workspace change for different directory
        act(() => {
            changeHandler!({ parent: "/other/path" });
        });

        // Should not trigger additional API calls
        expect(mockFetch.mock.calls.length).toBe(initialCallCount);
    });

    it("handles fetch errors gracefully", async () => {
        mockFetch.mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => useFileSystem());

        await waitFor(() => {
            expect(result.current.error).toBe("Network error");
            expect(result.current.loading).toBe(false);
        });
    });

    it("normalizes paths correctly", async () => {
        const { result } = renderHook(() => useFileSystem());

        await act(async () => {
            await result.current.goTo("src/components"); // without leading slash
        });

        // cspell: disable-next-line
        expect(mockFetch).toHaveBeenCalledWith(
            `http://localhost:3000${apiPrefix}/workspace?parent=src%2Fcomponents`,
            {
                headers: { accept: "application/json" },
            },
        );
    });
});
