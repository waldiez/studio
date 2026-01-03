/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import FileExplorer from "@/features/explorer/components/FileExplorer";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock UI components
vi.mock("@/components/ui/button", () => ({
    Button: ({ children, onClick, className, title, ...props }: any) => (
        <button onClick={onClick} className={className} title={title} {...props}>
            {children}
        </button>
    ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
    DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
    DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
    DropdownMenuItem: ({ children, onClick }: any) => (
        <div data-testid="dropdown-item" onClick={onClick}>
            {children}
        </div>
    ),
    DropdownMenuLabel: ({ children }: any) => <div data-testid="dropdown-label">{children}</div>,
    DropdownMenuSeparator: () => <div data-testid="dropdown-separator" />,
    DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
}));

vi.mock("@/components/ui/input", () => ({
    Input: ({ value, onChange, onBlur, onKeyDown, autoFocus, ...props }: any) => (
        <input
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            autoFocus={autoFocus}
            data-testid="rename-input"
            {...props}
        />
    ),
}));

vi.mock("lucide-react", () => ({
    ArrowUp: () => <div data-testid="arrow-up-icon" />,
    Folder: () => <div data-testid="folder-icon" />,
    MoreVertical: () => <div data-testid="more-vertical-icon" />,
    Pencil: () => <div data-testid="pencil-icon" />,
    Plus: () => <div data-testid="plus-icon" />,
    Trash2: () => <div data-testid="trash-icon" />,
    Upload: () => <div data-testid="upload-icon" />,
    RefreshCw: () => <div data-testid="refresh-icon" />,
    Download: () => <div data-testid="download-icon" />,
}));

vi.mock("@/lib/utils", () => ({
    cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

// Mock the file system hook
const mockFileSystem = {
    cwd: "/",
    items: [] as any[],
    loading: false,
    error: null as any,
    selection: null as any,
    setSelection: vi.fn(),
    goTo: vi.fn(),
    goUp: vi.fn(),
    createFolder: vi.fn(),
    createFile: vi.fn(),
    upload: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    list: vi.fn(),
    breadcrumbs: [{ label: "root", path: "/" }],
};

vi.mock("@/features/explorer/hooks/useFileSystem", () => ({
    useFileSystem: () => mockFileSystem,
}));

describe("FileExplorer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mock file system state
        mockFileSystem.cwd = "/";
        mockFileSystem.items = [];
        mockFileSystem.loading = false;
        mockFileSystem.error = null;
        mockFileSystem.selection = null;
        mockFileSystem.breadcrumbs = [{ label: "root", path: "/" }];
    });

    it("renders basic structure", () => {
        render(<FileExplorer />);

        expect(screen.getByTestId("arrow-up-icon")).toBeInTheDocument();
        expect(screen.getByTestId("folder-icon")).toBeInTheDocument();
        expect(screen.getByTestId("refresh-icon")).toBeInTheDocument();
        expect(screen.getByTestId("upload-icon")).toBeInTheDocument();
    });

    it("displays loading state", () => {
        mockFileSystem.loading = true;
        render(<FileExplorer />);

        expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("displays error state", () => {
        mockFileSystem.error = "Failed to load directory";
        render(<FileExplorer />);

        expect(screen.getByText("Failed to load directory")).toBeInTheDocument();
    });

    it("displays empty folder message", () => {
        mockFileSystem.items = [];
        render(<FileExplorer />);

        expect(screen.getByText("Empty folder")).toBeInTheDocument();
    });

    it("renders file and folder items", () => {
        mockFileSystem.items = [
            { type: "folder", name: "src", path: "src" },
            { type: "file", name: "README.md", path: "README.md" },
        ];

        render(<FileExplorer />);

        expect(screen.getByText("src")).toBeInTheDocument();
        expect(screen.getByText("README.md")).toBeInTheDocument();
        expect(screen.getAllByTestId("folder-icon")).toHaveLength(2);
        expect(screen.getAllByTestId("refresh-icon")).toHaveLength(1);
    });

    it("handles item selection", () => {
        const item = { type: "file" as const, name: "test.txt", path: "test.txt" };
        mockFileSystem.items = [item];

        render(<FileExplorer />);

        fireEvent.click(screen.getByText("test.txt"));

        expect(mockFileSystem.setSelection).toHaveBeenCalledWith(item);
    });

    it("handles folder double-click navigation", () => {
        const folder = { type: "folder", name: "src", path: "src" };
        mockFileSystem.items = [folder];

        render(<FileExplorer />);

        fireEvent.doubleClick(screen.getByText("src"));

        expect(mockFileSystem.goTo).toHaveBeenCalledWith("/src");
    });

    it("renders breadcrumbs", () => {
        mockFileSystem.breadcrumbs = [
            { label: "root", path: "/" },
            { label: "src", path: "/src" },
            { label: "components", path: "/src/components" },
        ];

        render(<FileExplorer />);

        expect(screen.getByText("root")).toBeInTheDocument();
        expect(screen.getByText("src")).toBeInTheDocument();
        expect(screen.getByText("components")).toBeInTheDocument();
    });

    it("handles breadcrumb navigation", () => {
        mockFileSystem.breadcrumbs = [
            { label: "root", path: "/" },
            { label: "src", path: "/src" },
        ];

        render(<FileExplorer />);

        fireEvent.click(screen.getByText("root"));

        expect(mockFileSystem.goTo).toHaveBeenCalledWith("/");
    });

    it("handles up navigation", () => {
        render(<FileExplorer />);

        const upButton = screen.getByTestId("arrow-up-icon").closest("button");
        fireEvent.click(upButton!);

        expect(mockFileSystem.goUp).toHaveBeenCalled();
    });

    it("handles folder creation", () => {
        render(<FileExplorer />);

        fireEvent.click(screen.getByTestId("folder-icon"));

        expect(mockFileSystem.createFolder).toHaveBeenCalled();
    });

    it("handles file creation", () => {
        render(<FileExplorer />);

        fireEvent.click(screen.getByTestId("waldiez-icon"));

        expect(mockFileSystem.createFile).toHaveBeenCalled();
    });

    it("handles file upload", async () => {
        render(<FileExplorer />);

        const file = new File(["content"], "test.txt", { type: "text/plain" });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, "files", {
            value: [file],
            writable: false,
        });
        fireEvent.change(fileInput);

        await waitFor(() => {
            expect(mockFileSystem.upload).toHaveBeenCalledWith(file);
        });
    });

    it("clears file input after upload", async () => {
        render(<FileExplorer />);
        const file = new File(["content"], "test.txt", { type: "text/plain" });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(fileInput, "files", {
            value: [file],
            writable: false,
        });

        fireEvent.change(fileInput);
        await waitFor(() => {
            expect(fileInput.value).toBe("");
        });
    });

    it("handles rename start", () => {
        const item = { type: "file", name: "test.txt", path: "test.txt" };
        mockFileSystem.items = [item];

        render(<FileExplorer />);

        // Click on dropdown trigger (MoreVertical icon)
        const dropdownTrigger = screen.getByTestId("more-vertical-icon").closest("div");
        fireEvent.click(dropdownTrigger!);

        // Click rename option
        const renameOption = screen.getByTestId("pencil-icon");
        fireEvent.click(renameOption);

        expect(screen.getByTestId("rename-input")).toBeInTheDocument();
        expect(screen.getByDisplayValue("test.txt")).toBeInTheDocument();
    });

    it("handles rename commit on Enter", async () => {
        const item = { type: "file", name: "test.txt", path: "test.txt" };
        mockFileSystem.items = [item];

        render(<FileExplorer />);

        // Start rename
        const dropdownTrigger = screen.getByTestId("more-vertical-icon").closest("div");
        fireEvent.click(dropdownTrigger!);
        const renameOption = screen.getByTestId("pencil-icon");
        fireEvent.click(renameOption);

        // Change name and press Enter
        const input = screen.getByTestId("rename-input");
        fireEvent.change(input, { target: { value: "renamed.txt" } });
        fireEvent.keyDown(input, { key: "Enter" });

        await waitFor(() => {
            expect(mockFileSystem.rename).toHaveBeenCalledWith("test.txt", "renamed.txt");
        });
    });

    it("handles rename cancel on Escape", () => {
        const item = { type: "file", name: "test.txt", path: "test.txt" };
        mockFileSystem.items = [item];

        render(<FileExplorer />);

        // Start rename
        const dropdownTrigger = screen.getByTestId("more-vertical-icon").closest("div");
        fireEvent.click(dropdownTrigger!);
        const renameOption = screen.getByTestId("pencil-icon");
        fireEvent.click(renameOption);

        // Press Escape
        const input = screen.getByTestId("rename-input");
        fireEvent.keyDown(input, { key: "Escape" });

        expect(screen.queryByTestId("rename-input")).not.toBeInTheDocument();
        expect(mockFileSystem.rename).not.toHaveBeenCalled();
    });

    it("handles rename commit on blur", async () => {
        const item = { type: "file", name: "test.txt", path: "test.txt" };
        mockFileSystem.items = [item];

        render(<FileExplorer />);

        // Start rename
        const dropdownTrigger = screen.getByTestId("more-vertical-icon").closest("div");
        fireEvent.click(dropdownTrigger!);
        const renameOption = screen.getByTestId("pencil-icon");
        fireEvent.click(renameOption);

        // Change name and blur
        const input = screen.getByTestId("rename-input");
        fireEvent.change(input, { target: { value: "renamed.txt" } });
        fireEvent.blur(input);

        await waitFor(() => {
            expect(mockFileSystem.rename).toHaveBeenCalledWith("test.txt", "renamed.txt");
        });
    });

    it("does not rename when name is unchanged", async () => {
        const item = { type: "file", name: "test.txt", path: "test.txt" };
        mockFileSystem.items = [item];

        render(<FileExplorer />);

        // Start rename
        const dropdownTrigger = screen.getByTestId("more-vertical-icon").closest("div");
        fireEvent.click(dropdownTrigger!);
        const renameOption = screen.getByTestId("pencil-icon");
        fireEvent.click(renameOption);

        // Press Enter without changing name
        const input = screen.getByTestId("rename-input");
        fireEvent.keyDown(input, { key: "Enter" });

        await waitFor(() => {
            expect(mockFileSystem.rename).not.toHaveBeenCalled();
        });
    });

    it("handles delete action", () => {
        const item = { type: "file", name: "test.txt", path: "test.txt" };
        mockFileSystem.items = [item];

        render(<FileExplorer />);

        // Click on dropdown trigger
        const dropdownTrigger = screen.getByTestId("more-vertical-icon").closest("div");
        fireEvent.click(dropdownTrigger!);

        // Click delete option
        const deleteOption = screen.getByTestId("trash-icon");
        fireEvent.click(deleteOption);

        expect(mockFileSystem.remove).toHaveBeenCalledWith("test.txt");
    });

    it("clears selection when clicking on empty area", () => {
        render(<FileExplorer />);

        const itemList = document.querySelector("ul");
        fireEvent.click(itemList!);

        expect(mockFileSystem.setSelection).toHaveBeenCalledWith(null);
    });

    it("highlights selected item", () => {
        const item = { type: "file", name: "test.txt", path: "test.txt" };
        mockFileSystem.items = [item];
        mockFileSystem.selection = item;

        render(<FileExplorer />);

        const listItem = screen.getByText("test.txt").closest("li");
        expect(listItem).toHaveClass("bg-(--primary-alt-color-hover)");
    });

    it("handles nested folder paths correctly", () => {
        const folder = { type: "folder", name: "components", path: "src/components" };
        mockFileSystem.items = [folder];

        render(<FileExplorer />);

        fireEvent.doubleClick(screen.getByText("components"));

        expect(mockFileSystem.goTo).toHaveBeenCalledWith("/src/components");
    });
});
