/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import MarkdownViewer from "@/features/viewers/components/MarkdownViewer";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("MarkdownViewer", () => {
    it("renders markdown content", () => {
        render(<MarkdownViewer source="# Hello World" />);

        expect(screen.getByTestId("markdown-content")).toBeInTheDocument();
    });

    it("applies default className", () => {
        const { container } = render(<MarkdownViewer source="test" />);

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveClass(
            "h-full",
            "w-full",
            "overflow-auto",
            "p-4",
            "prose",
            "prose-zinc",
            "dark:prose-invert",
        );
    });

    it("applies custom className", () => {
        const { container } = render(<MarkdownViewer source="test" className="custom-class" />);

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveClass("custom-class");
    });

    it("renders custom heading components", () => {
        render(<MarkdownViewer source="# Heading" />);

        const content = screen.getByTestId("markdown-content");
        const heading = content.querySelector("h1");

        expect(heading).toBeInTheDocument();
        expect(heading).toHaveClass("text-xl", "font-bold", "mb-3", "mt-2", "text-[var(--text-color)]");
        expect(heading).toHaveTextContent("Heading");
    });

    it("renders custom strong components", () => {
        render(<MarkdownViewer source="**bold**" />);

        const content = screen.getByTestId("markdown-content");
        const strong = content.querySelector("strong");

        expect(strong).toBeInTheDocument();
        expect(strong).toHaveClass("font-semibold", "text-[var(--text-color)]");
        expect(strong).toHaveTextContent("bold");
    });

    it("renders custom blockquote components", () => {
        render(<MarkdownViewer source="> quote" />);

        const content = screen.getByTestId("markdown-content");
        const blockquote = content.querySelector("blockquote");

        expect(blockquote).toBeInTheDocument();
        expect(blockquote).toHaveClass(
            "border-l-4",
            "border-[var(--primary-color)]",
            "pl-4",
            "my-3",
            "italic",
            "text-[var(--text-color)]",
            "opacity-90",
        );
    });

    it("renders custom link components", () => {
        render(<MarkdownViewer source="[link](url)" />);

        const content = screen.getByTestId("markdown-content");
        const link = content.querySelector("a");

        expect(link).toBeInTheDocument();
        expect(link).toHaveClass(
            "text-[var(--primary-color)]",
            "hover:text-[var(--primary-color-hover)]",
            "underline",
        );
        expect(link).toHaveAttribute("href", "url");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
        expect(link).toHaveTextContent("link");
    });

    it("handles empty source", () => {
        render(<MarkdownViewer source="" />);

        expect(screen.getByTestId("markdown-content")).toBeInTheDocument();
        expect(screen.getByTestId("markdown-content")).toHaveTextContent("");
    });

    it("handles complex markdown", () => {
        const complexMarkdown = `
    # Main Title
    ## Subtitle
    - List item 1
    - List item 2
    \`\`\`python
    print("code block")
    \`\`\`
            `;

        render(<MarkdownViewer source={complexMarkdown} />);

        expect(screen.getByTestId("markdown-content")).toBeInTheDocument();
        expect(screen.getByTestId("markdown-content").textContent).toContain("Main Title");
        expect(screen.getByTestId("markdown-content").textContent).toContain("Subtitle");
        expect(screen.getByTestId("markdown-content").textContent).toContain("List item 1");
    });

    it("renders different heading levels", () => {
        const { rerender } = render(<MarkdownViewer source="# H1" />);

        // Test different heading component styles would be applied
        // Since our mock is simplified, we just verify rendering works
        expect(screen.getByTestId("markdown-content")).toBeInTheDocument();

        rerender(<MarkdownViewer source="## H2" />);
        expect(screen.getByTestId("markdown-content")).toBeInTheDocument();

        rerender(<MarkdownViewer source="### H3" />);
        expect(screen.getByTestId("markdown-content")).toBeInTheDocument();

        rerender(<MarkdownViewer source="#### H4" />);
        expect(screen.getByTestId("markdown-content")).toBeInTheDocument();
    });

    it("handles special characters", () => {
        const specialMarkdown = '# Title with & < > " characters';

        render(<MarkdownViewer source={specialMarkdown} />);

        expect(screen.getByTestId("markdown-content")).toBeInTheDocument();
        expect(screen.getByTestId("markdown-content")).toHaveTextContent('Title with & < > " characters');
    });

    it("handles isNotebookCell prop", () => {
        // The prop exists in the type but isn't used in current implementation
        render(<MarkdownViewer source="# Test" isNotebookCell={true} />);

        expect(screen.getByTestId("markdown-content")).toBeInTheDocument();
    });
    it("handles lists", () => {
        const listMarkdown = `
- Item 1
- Item 2

1. First
2. Second
        `;

        render(<MarkdownViewer source={listMarkdown} />);

        const content = screen.getByTestId("markdown-content");

        // Unordered list
        const uls = content.querySelectorAll("ul");
        expect(uls.length).toBe(1);
        const ulItems = uls[0].querySelectorAll("li");
        expect(ulItems.length).toBe(2);
        expect(ulItems[0]).toHaveTextContent("Item 1");
        expect(ulItems[1]).toHaveTextContent("Item 2");

        // Ordered list
        const ols = content.querySelectorAll("ol");
        expect(ols.length).toBe(1);
        const olItems = ols[0].querySelectorAll("li");
        expect(olItems.length).toBe(2);
        expect(olItems[0]).toHaveTextContent("First");
        expect(olItems[1]).toHaveTextContent("Second");
    });

    it("handles tables", () => {
        const tableMarkdown = `
| Name  | Age |
|-------|-----|
| Alice | 30  |
| Bob   | 25  |
        `;

        render(<MarkdownViewer source={tableMarkdown} />);

        const content = screen.getByTestId("markdown-content");

        const table = content.querySelector("table");
        expect(table).toBeInTheDocument();

        const headerCells = Array.from(content.querySelectorAll("thead th")).map(el =>
            el.textContent?.trim(),
        );
        expect(headerCells).toEqual(["Name", "Age"]);

        const rows = content.querySelectorAll("tbody tr");
        expect(rows.length).toBe(2);

        const row1Cells = rows[0].querySelectorAll("td");
        const row2Cells = rows[1].querySelectorAll("td");

        expect(row1Cells[0]).toHaveTextContent("Alice");
        expect(row1Cells[1]).toHaveTextContent("30");
        expect(row2Cells[0]).toHaveTextContent("Bob");
        expect(row2Cells[1]).toHaveTextContent("25");
    });
});
