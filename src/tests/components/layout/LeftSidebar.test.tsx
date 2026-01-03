/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import LeftSidebar from "@/components/layout/LeftSidebar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/features/explorer/components/FileExplorer", () => ({
    default: () => <div data-testid="file-explorer">File Explorer Component</div>,
}));

describe("LeftSidebar", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders file explorer", () => {
        render(<LeftSidebar />);

        expect(screen.getByTestId("file-explorer")).toBeInTheDocument();
    });

    it("has correct layout structure", () => {
        const { container } = render(<LeftSidebar />);

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveClass("h-full", "flex", "flex-col");

        const flexChild = wrapper.querySelector(".flex-1.min-h-0");
        expect(flexChild).toBeInTheDocument();
    });
});
