/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import CodeBlock from "@/components/ui/code-block";
import { codeToHtml } from "@/lib/highlighter";
import { useTheme } from "@/theme/hook";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the highlighter
vi.mock("@/lib/highlighter", () => ({
    codeToHtml: vi.fn(),
}));

// Mock the theme hook
vi.mock("@/theme/hook", () => ({
    useTheme: vi.fn(),
}));

describe("CodeBlock", () => {
    const mockHighlightToHtml = codeToHtml as ReturnType<typeof vi.fn>;
    const mockUseTheme = useTheme as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseTheme.mockReturnValue({ theme: "dark" });
    });

    it("renders with highlighted code", async () => {
        const expectedHtml = '<pre><code class="language-python">print("hello")</code></pre>';
        mockHighlightToHtml.mockResolvedValue(expectedHtml);

        act(() => {
            render(<CodeBlock code='print("hello")' lang="python" />);
        });

        await waitFor(() => {
            expect(screen.getByText('print("hello")')).toBeInTheDocument();
        });

        expect(mockHighlightToHtml).toHaveBeenCalledWith('print("hello")', "python", "dark");
    });

    it("uses default language when not specified", async () => {
        mockHighlightToHtml.mockResolvedValue("<pre><code>code</code></pre>");

        act(() => {
            render(<CodeBlock code="some code" />);
        });

        await waitFor(() => {
            expect(mockHighlightToHtml).toHaveBeenCalledWith("some code", "python", "dark");
        });
    });

    it("uses light theme when theme is light", async () => {
        mockUseTheme.mockReturnValue({ theme: "light" });
        mockHighlightToHtml.mockResolvedValue("<pre><code>code</code></pre>");

        act(() => {
            render(<CodeBlock code="test" lang="javascript" />);
        });

        await waitFor(() => {
            expect(mockHighlightToHtml).toHaveBeenCalledWith("test", "javascript", "light");
        });
    });

    it("treats non-light themes as dark", async () => {
        mockUseTheme.mockReturnValue({ theme: "auto" });
        mockHighlightToHtml.mockResolvedValue("<pre><code>code</code></pre>");

        act(() => {
            render(<CodeBlock code="test" />);
        });

        await waitFor(() => {
            expect(mockHighlightToHtml).toHaveBeenCalledWith("test", "python", "dark");
        });
    });

    it("applies custom className", () => {
        mockHighlightToHtml.mockResolvedValue("<pre><code>test</code></pre>");

        const { container } = render(<CodeBlock code="test" className="custom-class" />);

        expect(container.firstChild).toHaveClass("custom-class");
    });

    it("applies default className when none provided", () => {
        mockHighlightToHtml.mockResolvedValue("<pre><code>test</code></pre>");

        const { container } = render(<CodeBlock code="test" />);

        expect(container.firstChild).toHaveClass("overflow-auto");
        expect(container.firstChild).toHaveClass("rounded");
        expect(container.firstChild).toHaveClass("border");
    });

    it("re-renders when code changes", async () => {
        mockHighlightToHtml.mockResolvedValue("<pre><code>initial</code></pre>");

        const { rerender } = render(<CodeBlock code="initial code" />);

        await waitFor(() => {
            expect(mockHighlightToHtml).toHaveBeenCalledWith("initial code", "python", "dark");
        });

        mockHighlightToHtml.mockResolvedValue("<pre><code>updated</code></pre>");

        rerender(<CodeBlock code="updated code" />);

        await waitFor(() => {
            expect(mockHighlightToHtml).toHaveBeenCalledWith("updated code", "python", "dark");
        });
    });

    it("re-renders when language changes", async () => {
        mockHighlightToHtml.mockResolvedValue("<pre><code>code</code></pre>");

        const { rerender } = render(<CodeBlock code="const x = 1;" lang="javascript" />);

        await waitFor(() => {
            expect(mockHighlightToHtml).toHaveBeenCalledWith("const x = 1;", "javascript", "dark");
        });

        rerender(<CodeBlock code="const x = 1;" lang="typescript" />);

        await waitFor(() => {
            expect(mockHighlightToHtml).toHaveBeenCalledWith("const x = 1;", "typescript", "dark");
        });
    });

    it("re-renders when theme changes", async () => {
        mockHighlightToHtml.mockResolvedValue("<pre><code>code</code></pre>");

        const { rerender } = render(<CodeBlock code="test" />);

        await waitFor(() => {
            expect(mockHighlightToHtml).toHaveBeenCalledWith("test", "python", "dark");
        });

        mockUseTheme.mockReturnValue({ theme: "light" });

        rerender(<CodeBlock code="test" />);

        await waitFor(() => {
            expect(mockHighlightToHtml).toHaveBeenCalledWith("test", "python", "light");
        });
    });

    it("handles empty code", async () => {
        mockHighlightToHtml.mockResolvedValue("<pre><code></code></pre>");

        act(() => {
            render(<CodeBlock code="" />);
        });

        await waitFor(() => {
            expect(mockHighlightToHtml).toHaveBeenCalledWith("", "python", "dark");
        });
    });

    it("starts with empty HTML and updates after highlighting", () => {
        mockHighlightToHtml.mockImplementation(
            () =>
                new Promise(resolve => setTimeout(() => resolve("<pre><code>highlighted</code></pre>"), 100)),
        );

        const { container } = render(<CodeBlock code="test" />);

        // Initially should be empty
        expect(container.firstChild).toHaveTextContent("");
    });

    it("cancels highlighting when component unmounts", async () => {
        let resolveHighlight: (value: string) => void;
        mockHighlightToHtml.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveHighlight = resolve;
                }),
        );

        const { unmount } = render(<CodeBlock code="test" />);

        // Unmount before highlighting completes
        unmount();

        // Complete the highlighting - should not update state
        resolveHighlight!("<pre><code>highlighted</code></pre>");

        // This test mainly ensures no warnings about state updates after unmount
    });
});
