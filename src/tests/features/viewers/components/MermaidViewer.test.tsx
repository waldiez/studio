/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import MermaidViewer from "@/features/viewers/components/MermaidViewer";
import { render } from "@testing-library/react";
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
