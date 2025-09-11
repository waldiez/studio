/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import MermaidViewer from "@/features/viewers/components/MermaidViewer";
import { render, screen, waitFor } from "@testing-library/react";
import mermaid from "mermaid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- Hoisted mocks (avoid "Cannot access ... before initialization") ----
const mmd = vi.hoisted(() => {
    return {
        initialize: vi.fn(),
        render: vi.fn(),
    };
});

vi.mock("mermaid", () => ({
    default: mmd,
    ...mmd, // also expose named for safety
}));

// Theme hook mock (safe: factory closes over mockTheme but doesn't read it at mock time)
let mockTheme: "light" | "dark" = "light";
vi.mock("@/theme/hook", () => ({
    useTheme: () => ({ theme: mockTheme }),
}));

describe("MermaidViewer", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        (mermaid.initialize as any).mockReset();
        (mermaid.render as any).mockReset();
        mockTheme = "light";
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it("renders SVG and applies width/height/style tweaks on success", async () => {
        (mermaid.render as any).mockResolvedValueOnce({
            svg: '<svg height="200" width="300"><g></g></svg>',
        });

        const { container } = render(<MermaidViewer source={"graph TD; A-->B"} debounceMs={30} />);
        vi.advanceTimersByTime(35);

        expect(mermaid.initialize).toHaveBeenCalledWith({
            startOnLoad: false,
            theme: "default", // light -> default
            securityLevel: "strict",
        });

        expect(mermaid.render).toHaveBeenCalledTimes(1);
        expect((mermaid.render as any).mock.calls[0][1]).toBe("graph TD; A-->B");

        const host = screen.getByTestId("mermaid-container");
        await waitFor(() => expect(host.querySelector("svg")).toBeTruthy());
        const svg = container.querySelector("svg") as SVGElement;
        expect(svg).toBeInTheDocument();
        expect(svg.getAttribute("height")).toBeNull();
        expect(svg.getAttribute("width")).toBe("100%");
        expect(svg.style.height).toBe("auto");
        expect(svg.style.margin).toBe("auto");
    });

    it("shows an error message and clears content when mermaid.render rejects", async () => {
        (mermaid.render as any).mockRejectedValueOnce(new Error("Parse error"));

        const { container } = render(<MermaidViewer source={"graph TD; A-->B"} debounceMs={10} />);

        vi.advanceTimersByTime(15);

        const pre = await screen.findByText(/Mermaid error: Parse error/i);
        expect(pre).toBeInTheDocument();
        expect(container.querySelector("svg")).toBeNull();
    });

    it("does not call mermaid.render if unmounted before debounce fires", () => {
        (mermaid.render as any).mockResolvedValueOnce({ svg: "<svg></svg>" });

        const { unmount } = render(<MermaidViewer source={"graph TD; A-->B"} debounceMs={500} />);
        unmount();

        vi.advanceTimersByTime(600);
        expect(mermaid.render).not.toHaveBeenCalled();
    });

    it("passes dark theme correctly to mermaid.initialize", () => {
        mockTheme = "dark";
        (mermaid.render as any).mockResolvedValueOnce({ svg: "<svg></svg>" });

        render(<MermaidViewer source={"graph TD; A-->B"} debounceMs={1} />);
        vi.advanceTimersByTime(2);

        expect(mermaid.initialize).toHaveBeenCalledWith({
            startOnLoad: false,
            theme: "dark",
            securityLevel: "strict",
        });
    });
});
