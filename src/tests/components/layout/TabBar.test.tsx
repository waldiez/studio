/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import TabBar from "@/components/layout/TabBar";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock stores
const mockWorkspaceStore = {
    openTabs: [] as any[],
    activeTabId: null as any,
    closeTab: vi.fn(),
    setActiveTab: vi.fn(),
    pinTab: vi.fn(),
    unpinTab: vi.fn(),
    closeAllTabs: vi.fn(),
    closeOtherTabs: vi.fn(),
};

const mockDraftsStore = {
    getDraft: vi.fn(),
};

vi.mock("@/store/workspace", () => ({
    useWorkspace: () => mockWorkspaceStore,
}));

vi.mock("@/store/drafts", () => ({
    useDrafts: () => mockDraftsStore,
}));

// Mock UI components
vi.mock("@/components/ui/button", () => ({
    Button: ({ children, onClick, ...props }: any) => (
        <button onClick={onClick} {...props}>
            {children}
        </button>
    ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
    DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
    DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
    DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
    DropdownMenuItem: ({ children, onClick, disabled }: any) => (
        <button onClick={onClick} disabled={disabled} data-testid="dropdown-item">
            {children}
        </button>
    ),
    DropdownMenuSeparator: () => <div data-testid="dropdown-separator" />,
}));

vi.mock("@/components/ui/fileIcon", () => ({
    FileIcon: ({ name }: any) => <div data-testid={`file-icon-${name}`}>{name}</div>,
}));

vi.mock("lucide-react", () => ({
    MoreHorizontal: () => <div data-testid="more-horizontal-icon" />,
    Pin: () => <div data-testid="pin-icon" />,
    X: () => <div data-testid="x-icon" />,
}));

vi.mock("@/lib/utils", () => ({
    cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

describe("TabBar", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockWorkspaceStore.openTabs = [];
        mockWorkspaceStore.activeTabId = null;
        mockDraftsStore.getDraft.mockReturnValue(undefined);
    });

    it("returns null when no tabs are open", () => {
        const { container } = render(<TabBar />);
        expect(container.firstChild).toBeNull();
    });

    it("renders single tab", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "test.py", name: "test.py", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        expect(screen.getAllByText("test.py").length).toBeGreaterThan(0);
        expect(screen.getByTestId("file-icon-test.py")).toBeInTheDocument();
    });

    it("renders multiple tabs", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
            {
                id: "tab-2",
                item: { path: "file2.js", name: "file2.js", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        expect(screen.getAllByText("file1.py").length).toBeGreaterThan(0);
        expect(screen.getAllByText("file2.js").length).toBeGreaterThan(0);
    });

    it("calls setActiveTab when clicking on a tab", async () => {
        const user = userEvent.setup();
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
            {
                id: "tab-2",
                item: { path: "file2.js", name: "file2.js", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        await user.click(screen.getAllByText("file2.js")[0]);

        expect(mockWorkspaceStore.setActiveTab).toHaveBeenCalledWith("tab-2");
    });

    it("calls closeTab when clicking close button", async () => {
        const user = userEvent.setup();
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        const closeButton = screen.getByLabelText("Close tab");
        await user.click(closeButton);

        expect(mockWorkspaceStore.closeTab).toHaveBeenCalledWith("tab-1");
    });

    it("stops propagation when clicking close button", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        const closeButton = screen.getByLabelText("Close tab");
        fireEvent.click(closeButton);

        // closeTab should be called but setActiveTab should not
        expect(mockWorkspaceStore.closeTab).toHaveBeenCalledWith("tab-1");
        expect(mockWorkspaceStore.setActiveTab).not.toHaveBeenCalled();
    });

    it("shows pin indicator for pinned tabs", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: true,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        expect(screen.getByTestId("pin-icon")).toBeInTheDocument();
    });

    it("does not show pin indicator for unpinned tabs", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        expect(screen.queryByTestId("pin-icon")).not.toBeInTheDocument();
    });

    it("shows dirty indicator when file has unsaved changes", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";
        mockDraftsStore.getDraft.mockReturnValue("unsaved content");

        const { container } = render(<TabBar />);

        const dirtyIndicator = container.querySelector(".bg-\\[var\\(--accent-color\\)\\]");
        expect(dirtyIndicator).toBeInTheDocument();
    });

    it("does not show dirty indicator when file has no unsaved changes", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";
        mockDraftsStore.getDraft.mockReturnValue(undefined);

        const { container } = render(<TabBar />);

        const dirtyIndicators = container.querySelectorAll(".bg-\\[var\\(--accent-color\\)\\]");
        // Filter out the active tab border (which also has this class)
        const dotIndicators = Array.from(dirtyIndicators).filter(
            el => el.classList.contains("w-1.5") && el.classList.contains("h-1.5"),
        );
        expect(dotIndicators).toHaveLength(0);
    });

    it("renders dropdown menu", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
        expect(screen.getByTestId("more-horizontal-icon")).toBeInTheDocument();
    });

    it("calls closeOtherTabs when menu item is clicked", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
            {
                id: "tab-2",
                item: { path: "file2.js", name: "file2.js", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        const closeOtherButton = screen.getByText("Close Other Tabs");
        fireEvent.click(closeOtherButton);

        expect(mockWorkspaceStore.closeOtherTabs).toHaveBeenCalledWith("tab-1");
    });

    it("calls closeAllTabs when menu item is clicked", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        const closeAllButton = screen.getByText("Close All Tabs");
        fireEvent.click(closeAllButton);

        expect(mockWorkspaceStore.closeAllTabs).toHaveBeenCalled();
    });

    it("calls pinTab when menu item is clicked", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        const pinButton = screen.getByText("Pin Tab");
        fireEvent.click(pinButton);

        expect(mockWorkspaceStore.pinTab).toHaveBeenCalledWith("tab-1");
    });

    it("calls unpinTab when menu item is clicked", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: true,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        const unpinButton = screen.getByText("Unpin Tab");
        fireEvent.click(unpinButton);

        expect(mockWorkspaceStore.unpinTab).toHaveBeenCalledWith("tab-1");
    });

    it("disables Close Other Tabs when only one tab is open", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        const closeOtherButton = screen.getByText("Close Other Tabs");
        expect(closeOtherButton).toBeDisabled();
    });

    it("enables Close Other Tabs when multiple tabs are open", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
            {
                id: "tab-2",
                item: { path: "file2.js", name: "file2.js", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        const closeOtherButton = screen.getByText("Close Other Tabs");
        expect(closeOtherButton).not.toBeDisabled();
    });

    it("disables Pin Tab when no active tab", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = null;

        render(<TabBar />);

        const pinButton = screen.getByText("Pin Tab");
        expect(pinButton).toBeDisabled();
    });

    it("disables Pin Tab when active tab is already pinned", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: true,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        const pinButton = screen.getByText("Pin Tab");
        expect(pinButton).toBeDisabled();
    });

    it("disables Unpin Tab when no active tab", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: true,
            },
        ];
        mockWorkspaceStore.activeTabId = null;

        render(<TabBar />);

        const unpinButton = screen.getByText("Unpin Tab");
        expect(unpinButton).toBeDisabled();
    });

    it("disables Unpin Tab when active tab is not pinned", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        const unpinButton = screen.getByText("Unpin Tab");
        expect(unpinButton).toBeDisabled();
    });

    it("prevents default on context menu", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        const tab = screen.getAllByText("file1.py")[0].closest("div");
        const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
        const preventDefaultSpy = vi.spyOn(event, "preventDefault");

        tab?.dispatchEvent(event);

        expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("truncates long file names", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: {
                    path: "very-long-file-name-that-should-be-truncated.py",
                    name: "very-long-file-name-that-should-be-truncated.py",
                    type: "file" as const,
                },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        const { container } = render(<TabBar />);

        const fileName = container.querySelector(".truncate");
        expect(fileName).toBeInTheDocument();
        expect(fileName).toHaveClass("text-sm");
    });

    it("shows file icons for different file types", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: false,
            },
            {
                id: "tab-2",
                item: { path: "file2.js", name: "file2.js", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";

        render(<TabBar />);

        expect(screen.getByTestId("file-icon-file1.py")).toBeInTheDocument();
        expect(screen.getByTestId("file-icon-file2.js")).toBeInTheDocument();
    });

    it("handles multiple pinned and dirty tabs", () => {
        mockWorkspaceStore.openTabs = [
            {
                id: "tab-1",
                item: { path: "file1.py", name: "file1.py", type: "file" as const },
                isPinned: true,
            },
            {
                id: "tab-2",
                item: { path: "file2.js", name: "file2.js", type: "file" as const },
                isPinned: false,
            },
        ];
        mockWorkspaceStore.activeTabId = "tab-1";
        mockDraftsStore.getDraft.mockImplementation(path => {
            if (path === "/file1.py") {
                return "unsaved";
            }
            return undefined;
        });

        render(<TabBar />);

        expect(screen.getByTestId("pin-icon")).toBeInTheDocument();
        expect(screen.getAllByText("file1.py").length).toBeGreaterThan(0);
        expect(screen.getAllByText("file2.js").length).toBeGreaterThan(0);
    });
});
