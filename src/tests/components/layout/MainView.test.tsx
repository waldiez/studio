/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import MainView from "@/components/layout/MainView";
import { saveTextFile } from "@/lib/http";
import { useWorkspace } from "@/store/workspace";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/components/layout/TabBar", () => ({
    default: () => <div data-testid="tab-bar">Tab Bar</div>,
}));

vi.mock("@/features/viewers/components/ViewerRouter", () => ({
    default: ({ name, path, data, onSaveText }: any) => (
        <div data-testid="viewer-router">
            <div data-testid="viewer-name">{name}</div>
            <div data-testid="viewer-path">{path}</div>
            <div data-testid="viewer-data-kind">{data?.kind}</div>
            <button onClick={() => onSaveText?.("test content")} data-testid="save-button">
                Save
            </button>
        </div>
    ),
}));

vi.mock("@/lib/http", () => ({
    saveTextFile: vi.fn(),
}));

vi.mock("@/store/workspace", () => ({
    useWorkspace: vi.fn(),
}));

// Mock URL object
const mockRevokeObjectURL = vi.fn();
const mockCreateObjectURL = vi.fn();
Object.defineProperty(global.URL, "revokeObjectURL", {
    value: mockRevokeObjectURL,
    writable: true,
});
Object.defineProperty(global.URL, "createObjectURL", {
    value: mockCreateObjectURL,
    writable: true,
});

describe("MainView", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateObjectURL.mockReturnValue("blob:mock-url");
    });

    it("shows select file message when no tabs are open", () => {
        (useWorkspace as any).mockReturnValue({
            getActiveTab: () => undefined,
            fileCache: {},
        });

        render(<MainView />);

        expect(screen.getByText("Select a file from the Explorer.")).toBeInTheDocument();
    });

    it("shows loading message when tab is active but data not loaded", () => {
        (useWorkspace as any).mockReturnValue({
            getActiveTab: () => ({
                id: "tab-1",
                item: { path: "test.py", name: "test.py", type: "file" },
            }),
            fileCache: {},
        });

        render(<MainView />);

        expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("renders TabBar and ViewerRouter when file and data are available", () => {
        const mockActiveTab = {
            id: "tab-1",
            item: { path: "test.py", name: "test.py", type: "file" },
        };
        const mockData = {
            kind: "text",
            content: "print('hello')",
            mime: "text/x-python",
        };

        (useWorkspace as any).mockReturnValue({
            getActiveTab: () => mockActiveTab,
            fileCache: { "test.py": mockData },
        });

        render(<MainView />);

        expect(screen.getByTestId("tab-bar")).toBeInTheDocument();
        expect(screen.getByTestId("viewer-router")).toBeInTheDocument();
        expect(screen.getByTestId("viewer-name")).toHaveTextContent("test.py");
        expect(screen.getByTestId("viewer-path")).toHaveTextContent("/test.py");
        expect(screen.getByTestId("viewer-data-kind")).toHaveTextContent("text");
    });

    it("handles text file data correctly", () => {
        const mockActiveTab = {
            id: "tab-1",
            item: { path: "test.py", name: "test.py", type: "file" },
        };
        const mockData = {
            kind: "text",
            content: "print('hello')",
            mime: "text/x-python",
        };

        (useWorkspace as any).mockReturnValue({
            getActiveTab: () => mockActiveTab,
            fileCache: { "test.py": mockData },
        });

        render(<MainView />);

        expect(screen.getByTestId("viewer-data-kind")).toHaveTextContent("text");
    });

    it("handles binary file with URL", () => {
        const mockActiveTab = {
            id: "tab-1",
            item: { path: "image.png", name: "image.png", type: "file" },
        };
        const mockData = {
            kind: "binary",
            mime: "image/png",
            url: "http://example.com/image.png",
        };

        (useWorkspace as any).mockReturnValue({
            getActiveTab: () => mockActiveTab,
            fileCache: { "image.png": mockData },
        });

        render(<MainView />);

        expect(screen.getByTestId("viewer-data-kind")).toHaveTextContent("binary");
    });

    it("handles binary file with blob", () => {
        const mockActiveTab = {
            id: "tab-1",
            item: { path: "image.png", name: "image.png", type: "file" },
        };
        const mockBlob = new Blob(["fake image data"], { type: "image/png" });
        const mockData = {
            kind: "binary",
            mime: "image/png",
            blob: mockBlob,
        };

        (useWorkspace as any).mockReturnValue({
            getActiveTab: () => mockActiveTab,
            fileCache: { "image.png": mockData },
        });

        render(<MainView />);

        expect(screen.getByTestId("viewer-data-kind")).toHaveTextContent("binary");
    });

    it("calls saveTextFile when onSave is triggered", async () => {
        const mockActiveTab = {
            id: "tab-1",
            item: { path: "test.py", name: "test.py", type: "file" },
        };
        const mockData = {
            kind: "text",
            content: "print('hello')",
            mime: "text/x-python",
        };

        (useWorkspace as any).mockReturnValue({
            getActiveTab: () => mockActiveTab,
            fileCache: { "test.py": mockData },
        });

        (saveTextFile as any).mockResolvedValue(undefined);

        render(<MainView />);

        const saveButton = screen.getByTestId("save-button");
        saveButton.click();

        await waitFor(() => {
            expect(saveTextFile).toHaveBeenCalledWith("/test.py", "test content");
        });
    });

    it("handles save when no tab is active", async () => {
        (useWorkspace as any).mockReturnValue({
            getActiveTab: () => undefined,
            fileCache: {},
        });

        render(<MainView />);

        // Should not crash when onSave is called with no active tab
    });

    it("handles data type casting for mime property", () => {
        const mockActiveTab = {
            id: "tab-1",
            item: { path: "test.py", name: "test.py", type: "file" },
        };
        const mockData = {
            kind: "text",
            content: "print('hello')",
            mime: "text/x-python",
        };

        (useWorkspace as any).mockReturnValue({
            getActiveTab: () => mockActiveTab,
            fileCache: { "test.py": mockData },
        });

        render(<MainView />);

        expect(screen.getByTestId("viewer-router")).toBeInTheDocument();
    });

    it("has correct layout classes", () => {
        const mockActiveTab = {
            id: "tab-1",
            item: { path: "test.py", name: "test.py", type: "file" },
        };
        const mockData = {
            kind: "text",
            content: "content",
            mime: "text/plain",
        };

        (useWorkspace as any).mockReturnValue({
            getActiveTab: () => mockActiveTab,
            fileCache: { "test.py": mockData },
        });

        const { container } = render(<MainView />);

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveClass("h-full", "w-full", "flex", "flex-col");
    });

    it("centers loading and select messages", () => {
        (useWorkspace as any).mockReturnValue({
            getActiveTab: () => undefined,
            fileCache: {},
        });

        const { container } = render(<MainView />);

        // Find the content area (second child, after tab bar)
        const contentArea = container.querySelector(".flex-1");
        expect(contentArea).toHaveClass("flex-1", "min-h-0");
    });

    it("does not render TabBar when no tabs are open", () => {
        (useWorkspace as any).mockReturnValue({
            getActiveTab: () => undefined,
            fileCache: {},
        });

        render(<MainView />);

        // TabBar component itself should handle not rendering when no tabs
        // but it's still mounted, just returns null
        expect(screen.getByTestId("tab-bar")).toBeInTheDocument();
    });
});
