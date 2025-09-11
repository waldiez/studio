/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import NotebookViewer from "@/features/viewers/components/NotebookViewer";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/theme/hook", () => ({
    useTheme: () => ({ theme: "light" }),
}));

vi.mock("shiki", () => ({
    codeToHtml: vi.fn().mockResolvedValue("<pre><code>highlighted code</code></pre>"),
}));

vi.mock("@/features/viewers/components/MarkdownViewer", () => ({
    default: ({ source }: any) => <div data-testid="markdown-viewer">{source}</div>,
}));

describe("NotebookViewer", () => {
    it("renders error for null notebook", () => {
        render(<NotebookViewer note={null} />);

        expect(screen.getByText("Invalid notebook.")).toBeInTheDocument();
    });

    it("applies default className", () => {
        const { container } = render(<NotebookViewer note={{ cells: [] }} />);

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveClass("h-full", "w-full", "overflow-auto", "p-3", "space-y-4");
    });

    it("applies custom className", () => {
        const { container } = render(<NotebookViewer note={{ cells: [] }} className="custom-class" />);

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveClass("custom-class");
    });

    it("renders empty notebook", () => {
        act(() => {
            render(<NotebookViewer note={{ cells: [] }} />);
        });

        const container = document.querySelector(".h-full.w-full.overflow-auto.p-3.space-y-4");
        expect(container).toBeInTheDocument();
        expect(container?.children).toHaveLength(0);
    });

    it("renders markdown cells", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "markdown" as const,
                    source: "# Hello World\nThis is markdown",
                },
            ],
        };

        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        expect(screen.getByTestId("markdown-viewer")).toBeInTheDocument();
        expect(screen.getByTestId("markdown-viewer")).toHaveTextContent("# Hello World This is markdown");
    });

    it("renders code cells with execution count", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "code" as const,
                    source: "print('hello world')",
                    execution_count: 1,
                },
            ],
        };

        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        expect(screen.getByText("In [1]:")).toBeInTheDocument();
    });

    it("handles code cells without execution count", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "code" as const,
                    source: "print('hello world')",
                    execution_count: null,
                },
            ],
        };

        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        expect(screen.getByText("In [ ]:")).toBeInTheDocument();
    });

    it("handles array source in cells", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "markdown" as const,
                    source: ["# Title\n", "Some content"],
                },
            ],
        };

        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        expect(screen.getByTestId("markdown-viewer")).toHaveTextContent("# Title Some content");
    });

    it("handles cells with outputs", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "code" as const,
                    source: "print('hello')",
                    execution_count: 1,
                    outputs: [
                        {
                            output_type: "stream",
                            name: "stdout",
                            text: "hello\n",
                        },
                    ],
                },
            ],
        };

        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        expect(screen.getByText("Output:")).toBeInTheDocument();
        expect(screen.getByText("hello")).toBeInTheDocument();
    });

    it("handles cells without outputs", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "code" as const,
                    source: "x = 1",
                    execution_count: 1,
                },
            ],
        };

        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        expect(screen.queryByText("Output:")).not.toBeInTheDocument();
    });

    it("handles cells with empty outputs array", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "code" as const,
                    source: "x = 1",
                    execution_count: 1,
                    outputs: [],
                },
            ],
        };

        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        expect(screen.queryByText("Output:")).not.toBeInTheDocument();
    });

    it("handles error outputs", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "code" as const,
                    source: "1/0",
                    execution_count: 1,
                    outputs: [
                        {
                            output_type: "error",
                            ename: "ZeroDivisionError",
                            evalue: "division by zero",
                            traceback: [
                                "Traceback (most recent call last):",
                                "ZeroDivisionError: division by zero",
                            ],
                        },
                    ],
                },
            ],
        };

        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        expect(screen.getByText("ZeroDivisionError:")).toBeInTheDocument();
        expect(screen.getByText("division by zero")).toBeInTheDocument();
    });

    it("handles display data with images", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "code" as const,
                    source: "plt.plot([1,2,3])",
                    execution_count: 1,
                    outputs: [
                        {
                            output_type: "display_data",
                            data: {
                                "image/png":
                                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                            },
                        },
                    ],
                },
            ],
        };

        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        const img = screen.getByRole("img");
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute("src", expect.stringContaining("data:image/png;base64,"));
    });

    it("handles text/plain outputs", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "code" as const,
                    source: "2 + 2",
                    execution_count: 1,
                    outputs: [
                        {
                            output_type: "execute_result",
                            data: {
                                "text/plain": "4",
                            },
                        },
                    ],
                },
            ],
        };
        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        expect(screen.getByText("4")).toBeInTheDocument();
    });

    it("handles HTML outputs", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "code" as const,
                    source: "df.head()",
                    execution_count: 1,
                    outputs: [
                        {
                            output_type: "execute_result",
                            data: {
                                "text/html": "<table><tr><td>Hello</td></tr></table>",
                            },
                        },
                    ],
                },
            ],
        };

        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        expect(screen.getByText("Hello")).toBeInTheDocument();
    });

    it("handles stderr output with error styling", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "code" as const,
                    source: "import warnings; warnings.warn('test')",
                    execution_count: 1,
                    outputs: [
                        {
                            output_type: "stream",
                            name: "stderr",
                            text: "Warning: test warning",
                        },
                    ],
                },
            ],
        };

        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        const output = screen.getByText("Warning: test warning");
        expect(output.closest("pre")).toHaveClass("text-red-600", "dark:text-red-400");
    });

    it("handles JSON outputs", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "code" as const,
                    source: "{'key': 'value'}",
                    execution_count: 1,
                    outputs: [
                        {
                            output_type: "execute_result",
                            data: {
                                "application/json": { key: "value" },
                            },
                        },
                    ],
                },
            ],
        };

        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        expect(screen.getByText(/"key": "value"/)).toBeInTheDocument();
    });

    it("handles mixed cell types", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "markdown" as const,
                    source: "# Analysis",
                },
                {
                    cell_type: "code" as const,
                    source: "print('Starting analysis')",
                    execution_count: 1,
                    outputs: [
                        {
                            output_type: "stream",
                            name: "stdout",
                            text: "Starting analysis\n",
                        },
                    ],
                },
            ],
        };

        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        expect(screen.getByTestId("markdown-viewer")).toBeInTheDocument();
        expect(screen.getByText("In [1]:")).toBeInTheDocument();
        expect(screen.getByText("Starting analysis")).toBeInTheDocument();
    });

    it("handles empty cells gracefully", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "code" as const,
                    source: "",
                    execution_count: 1,
                },
                {
                    cell_type: "markdown" as const,
                    source: "",
                },
            ],
        };

        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        expect(screen.getByText("In [1]:")).toBeInTheDocument();
        expect(screen.getByTestId("markdown-viewer")).toBeInTheDocument();
    });

    it("handles cells with missing properties", () => {
        const notebook = {
            cells: [
                {
                    cell_type: "code" as const,
                    // Missing source, execution_count, outputs
                },
            ],
        };

        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        expect(screen.getByText("In [ ]:")).toBeInTheDocument();
    });

    it("handles notebooks with metadata", () => {
        const notebook = {
            cells: [],
            metadata: {
                kernelspec: {
                    display_name: "Python 3",
                    language: "python",
                    name: "python3",
                },
            },
            nbformat: 4,
            nbformat_minor: 5,
        };
        act(() => {
            render(<NotebookViewer note={notebook} />);
        });

        // Should render without errors
        const container = document.querySelector(".h-full.w-full.overflow-auto.p-3.space-y-4");
        expect(container).toBeInTheDocument();
    });
});
