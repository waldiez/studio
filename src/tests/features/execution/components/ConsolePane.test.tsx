/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import ConsolePane from "@/features/execution/components/ConsolePane";
import { useExec } from "@/store/exec";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the exec store
vi.mock("@/store/exec", () => ({
    useExec: vi.fn(),
}));

// Mock scrollIntoView
const mockScrollIntoView = vi.fn();
Object.defineProperty(Element.prototype, "scrollIntoView", {
    value: mockScrollIntoView,
    writable: true,
});

describe("ConsolePane", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockScrollIntoView.mockClear();
    });

    it("renders empty console", () => {
        vi.mocked(useExec).mockReturnValue({ lines: [] });

        const { container } = render(<ConsolePane />);

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveClass("h-full", "w-full", "font-mono", "text-sm", "overflow-auto", "p-2");
    });

    it("renders stdout lines", () => {
        vi.mocked(useExec).mockReturnValue({
            lines: [
                { kind: "stdout", text: "Hello World" },
                { kind: "stdout", text: "Line 2" },
            ],
        });

        render(<ConsolePane />);

        expect(screen.getByText("Hello World")).toBeInTheDocument();
        expect(screen.getByText("Line 2")).toBeInTheDocument();
    });

    it("renders stderr lines with error styling", () => {
        vi.mocked(useExec).mockReturnValue({
            lines: [{ kind: "stderr", text: "Error message" }],
        });

        render(<ConsolePane />);

        const errorLine = screen.getByText("Error message");
        expect(errorLine).toBeInTheDocument();
        expect(errorLine).toHaveClass("text-[var(--ansi-red)]");
    });

    it("renders system lines with opacity", () => {
        vi.mocked(useExec).mockReturnValue({
            lines: [{ kind: "system", text: "System message" }],
        });

        render(<ConsolePane />);

        const systemLine = screen.getByText("System message");
        expect(systemLine).toBeInTheDocument();
        expect(systemLine).toHaveClass("opacity-70");
    });

    it("renders mixed line types with correct styling", () => {
        vi.mocked(useExec).mockReturnValue({
            lines: [
                { kind: "stdout", text: "Normal output" },
                { kind: "stderr", text: "Error output" },
                { kind: "system", text: "System output" },
            ],
        });

        render(<ConsolePane />);

        const normalLine = screen.getByText("Normal output");
        const errorLine = screen.getByText("Error output");
        const systemLine = screen.getByText("System output");

        expect(normalLine).toBeInTheDocument();
        expect(errorLine).toHaveClass("text-[var(--ansi-red)]");
        expect(systemLine).toHaveClass("opacity-70");
    });

    it("uses pre elements for line formatting", () => {
        vi.mocked(useExec).mockReturnValue({
            lines: [{ kind: "stdout", text: "Indented text" }],
        });

        render(<ConsolePane />);

        const line = screen.getByText("Indented text");
        expect(line.tagName).toBe("PRE");
    });

    it("handles empty text lines", () => {
        vi.mocked(useExec).mockReturnValue({
            lines: [
                { kind: "stdout", text: "" },
                { kind: "stdout", text: "Non-empty" },
            ],
        });

        render(<ConsolePane />);

        expect(screen.getByText("Non-empty")).toBeInTheDocument();
        const preElements = document.querySelectorAll("pre");
        expect(preElements).toHaveLength(2);
    });

    it("scrolls to bottom when lines change", () => {
        vi.mocked(useExec).mockReturnValue({
            lines: [{ kind: "stdout", text: "Initial line" }],
        });

        const { rerender } = render(<ConsolePane />);

        expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });

        mockScrollIntoView.mockClear();

        // Add more lines
        vi.mocked(useExec).mockReturnValue({
            lines: [
                { kind: "stdout", text: "Initial line" },
                { kind: "stdout", text: "New line" },
            ],
        });

        rerender(<ConsolePane />);

        expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
    });

    it("handles large number of lines", () => {
        const manyLines = Array.from({ length: 100 }, (_, i) => ({
            kind: "stdout" as const,
            text: `Line ${i + 1}`,
        }));

        vi.mocked(useExec).mockReturnValue({ lines: manyLines });

        render(<ConsolePane />);

        expect(screen.getByText("Line 1")).toBeInTheDocument();
        expect(screen.getByText("Line 100")).toBeInTheDocument();
    });

    it("maintains correct key attributes for lines", () => {
        vi.mocked(useExec).mockReturnValue({
            lines: [
                { kind: "stdout", text: "Line 1" },
                { kind: "stderr", text: "Line 2" },
            ],
        });

        render(<ConsolePane />);

        const preElements = document.querySelectorAll("pre");
        expect(preElements).toHaveLength(2);
        expect(preElements[0]).toHaveTextContent("Line 1");
        expect(preElements[1]).toHaveTextContent("Line 2");
    });

    it("handles unknown line kinds as default styling", () => {
        vi.mocked(useExec).mockReturnValue({
            lines: [{ kind: "unknown" as any, text: "Unknown kind" }],
        });

        render(<ConsolePane />);

        const line = screen.getByText("Unknown kind");
        expect(line).toBeInTheDocument();
        expect(line).not.toHaveClass("text-[var(--ansi-red)]");
        expect(line).not.toHaveClass("opacity-70");
    });

    it("preserves line order", () => {
        vi.mocked(useExec).mockReturnValue({
            lines: [
                { kind: "stdout", text: "First" },
                { kind: "stderr", text: "Second" },
                { kind: "system", text: "Third" },
                { kind: "stdout", text: "Fourth" },
            ],
        });

        render(<ConsolePane />);

        const preElements = document.querySelectorAll("pre");
        expect(preElements[0]).toHaveTextContent("First");
        expect(preElements[1]).toHaveTextContent("Second");
        expect(preElements[2]).toHaveTextContent("Third");
        expect(preElements[3]).toHaveTextContent("Fourth");
    });

    it("includes scroll anchor div", () => {
        vi.mocked(useExec).mockReturnValue({ lines: [] });

        const { container } = render(<ConsolePane />);

        const children = container.firstChild?.childNodes;
        const lastChild = children?.[children.length - 1] as HTMLElement;
        expect(lastChild.tagName).toBe("DIV");
    });
});
