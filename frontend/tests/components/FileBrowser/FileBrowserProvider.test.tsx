/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { it, vi } from "vitest";

import * as fileBrowserService from "@waldiez/studio/api/fileBrowserService";
import { FileBrowserProvider, useFileBrowser } from "@waldiez/studio/components/FileBrowser";

vi.mock("@waldiez/studio/api/fileBrowserService", () => ({
    fetchFiles: vi.fn().mockResolvedValue({ items: [] }),
    createFolder: vi.fn(),
    createFile: vi.fn(),
    deleteFileOrFolder: vi.fn(),
    renameFileOrFolder: vi.fn(),
    uploadFile: vi.fn(),
    downloadFileOrFolder: vi.fn(),
}));

const TestComponent = () => {
    const { currentPath, entries, error, loading, setError, refresh } = useFileBrowser();
    return (
        <div>
            <div data-testid="current-path">{currentPath}</div>
            <div data-testid="loading">{loading ? "Loading" : "Not Loading"}</div>
            <div data-testid="error">{error}</div>
            <ul data-testid="entries">
                {entries.map(entry => (
                    <li key={entry.path}>{entry.name}</li>
                ))}
            </ul>
            <button onClick={() => setError("Test Error")}>Set Error</button>
            <button onClick={refresh}>Refresh</button>
        </div>
    );
};

describe("FileBrowserProvider", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("provides context to children", async () => {
        render(
            <FileBrowserProvider>
                <TestComponent />
            </FileBrowserProvider>,
        );

        expect(screen.getByTestId("current-path")).toHaveTextContent("/");
        await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("Not Loading"));
        expect(screen.getByTestId("entries").children).toHaveLength(0);

        act(() => {
            screen.getByText("Set Error").click();
        });

        expect(screen.getByTestId("error")).toHaveTextContent("Test Error");
    });

    it("throws an error if no provider is found", () => {
        expect(() => render(<TestComponent />)).toThrow(
            "useFileBrowser must be used within a FileBrowserProvider",
        );
    });

    it("fetches entries on refresh", async () => {
        const fetchFilesMock = vi.mocked(fileBrowserService.fetchFiles).mockResolvedValue({
            items: [{ name: "test.txt", path: "/test.txt", type: "file" }],
        });

        render(
            <FileBrowserProvider>
                <TestComponent />
            </FileBrowserProvider>,
        );

        act(() => {
            screen.getByText("Refresh").click();
        });

        await waitFor(() => {
            expect(fetchFilesMock).toHaveBeenCalledWith("/");
            expect(screen.getByTestId("entries").children).toHaveLength(1);
            expect(screen.getByText("test.txt")).toBeInTheDocument();
        });
    });

    it("handles errors when fetching files", async () => {
        const fetchFilesMock = vi
            .mocked(fileBrowserService.fetchFiles)
            .mockRejectedValue(new Error("Fetch error"));
        render(
            <FileBrowserProvider>
                <TestComponent />
            </FileBrowserProvider>,
        );

        act(() => {
            screen.getByText("Refresh").click();
        });

        await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("Fetch error"));
        expect(fetchFilesMock).toHaveBeenCalled();
    });
});
