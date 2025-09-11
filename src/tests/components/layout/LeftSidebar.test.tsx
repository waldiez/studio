/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import LeftSidebar from "@/components/layout/LeftSidebar";
import { useWorkspace } from "@/store/workspace";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/features/explorer/components/FileExplorer", () => ({
    default: ({ onOpenFile }: any) => (
        <div data-testid="file-explorer">
            <button onClick={() => onOpenFile({ type: "file", path: "/test.py", name: "test.py" })}>
                Open File
            </button>
            <button onClick={() => onOpenFile({ type: "folder", path: "/folder", name: "folder" })}>
                Open Folder
            </button>
        </div>
    ),
}));

vi.mock("@/store/workspace", () => ({
    useWorkspace: vi.fn(),
}));

describe("LeftSidebar", () => {
    const mockSelect = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useWorkspace as any).mockImplementation((selector: any) => {
            return selector({ select: mockSelect });
        });
    });

    it("renders file explorer", () => {
        render(<LeftSidebar />);

        expect(screen.getByTestId("file-explorer")).toBeInTheDocument();
    });

    it("calls select when file is opened", () => {
        render(<LeftSidebar />);

        fireEvent.click(screen.getByText("Open File"));

        expect(mockSelect).toHaveBeenCalledWith({
            type: "file",
            path: "/test.py",
            name: "test.py",
        });
    });

    it("does not call select when folder is opened", () => {
        render(<LeftSidebar />);

        fireEvent.click(screen.getByText("Open Folder"));

        expect(mockSelect).not.toHaveBeenCalled();
    });

    it("has correct layout structure", () => {
        const { container } = render(<LeftSidebar />);

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveClass("h-full", "flex", "flex-col");

        const flexChild = wrapper.querySelector(".flex-1.min-h-0");
        expect(flexChild).toBeInTheDocument();
    });
});
