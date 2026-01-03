/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
/* eslint-disable no-control-regex */
import { codeToHtml } from "@/lib/highlighter";
import { useTheme } from "@/theme/hook";

import { useEffect, useState } from "react";

import MarkdownViewer from "./MarkdownViewer";

type Ipynb = {
    cells?: Array<{
        cell_type: "code" | "markdown";
        source?: string[] | string;
        outputs?: Array<any>;
        execution_count?: number | null;
    }>;
    metadata?: any;
    nbformat?: number;
    nbformat_minor?: number;
};

type Props = {
    note: Ipynb | null;
    className?: string;
};

export default function NotebookViewer({ note, className }: Props) {
    const theme = useTheme().theme;

    if (!note) {
        return <div className="p-4 text-sm text-red-500">Invalid notebook.</div>;
    }

    const cells = note.cells ?? [];

    return (
        <div className={className ?? "h-full w-full overflow-auto p-3 space-y-4"}>
            {cells.map((cell, idx) => {
                // Handle source properly - join array and clean up line endings
                let src = "";
                if (Array.isArray(cell.source)) {
                    src = cell.source.join("").replace(/↵/g, "\n");
                } else {
                    src = (cell.source || "").replace(/↵/g, "\n");
                }

                if (cell.cell_type === "markdown") {
                    return (
                        <div key={idx} className="prose prose-zinc dark:prose-invert max-w-none">
                            <MarkdownViewer source={src} />
                        </div>
                    );
                }

                // Code cell with Shiki syntax highlighting
                return (
                    <div key={idx} className="rounded border border-[var(--border-color)] overflow-hidden">
                        <div className="px-3 py-2 text-xs opacity-70 border-b border-[var(--border-color)] bg-[var(--primary-alt-color)]">
                            In [{cell.execution_count ?? " "}]:
                        </div>

                        {/* Shiki-based code display */}
                        <ShikiCodeBlock source={src} language="python" theme={theme} />

                        {/* Outputs */}
                        {Array.isArray(cell.outputs) && cell.outputs.length > 0 && (
                            <div className="border-t border-[var(--border-color)]">
                                <div className="px-3 py-1 text-xs opacity-70 bg-[var(--primary-alt-color)] border-b border-[var(--border-color)]">
                                    Output:
                                </div>
                                {cell.outputs.map((out, j) => (
                                    <OutputBlock key={j} out={out} />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* c8 ignore next -- @preserve */
function ShikiCodeBlock({ source, language, theme }: { source: string; language: string; theme: string }) {
    const [highlightedCode, setHighlightedCode] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let active = true;
        // eslint-disable-next-line max-statements
        const highlightCode = async () => {
            try {
                if (active) {
                    setIsLoading(true);
                }
                if (typeof window === "undefined") {
                    if (active) {
                        setHighlightedCode(`<pre><code>${escapeHtml(source)}</code></pre>`);
                        setIsLoading(false);
                    }
                    return;
                }
                const html = await codeToHtml(source, language, theme);
                if (active) {
                    setHighlightedCode(html);
                }
            } catch (error) {
                console.warn("Shiki highlighting failed:", error);
                if (active) {
                    // Fallback to plain text
                    setHighlightedCode(`<pre><code>${escapeHtml(source)}</code></pre>`);
                }
            } finally {
                if (active) {
                    setIsLoading(false);
                }
            }
        };

        highlightCode();
        return () => {
            active = false;
        };
    }, [source, language, theme]);

    if (isLoading) {
        return (
            <div className="p-3 text-sm opacity-70 bg-[var(--primary-alt-color)]">
                Loading syntax highlighting...
            </div>
        );
    }

    return (
        <div
            className="shiki-code-block overflow-auto max-h-[400px] text-sm"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
    );
}

// Helper function to escape HTML
function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// eslint-disable-next-line max-statements
function OutputBlock({ out }: { out: any }) {
    // Stream output (stdout/stderr)
    if (out.output_type === "stream") {
        const isError = out.name === "stderr";
        return (
            <pre
                className={`p-3 text-sm overflow-auto font-mono ${
                    isError
                        ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20"
                        : "text-[var(--text-color)] bg-[var(--background-color)]"
                }`}
            >
                <code>{Array.isArray(out.text) ? out.text.join("") : (out.text ?? "")}</code>
            </pre>
        );
    }

    // Display data / execute result
    if (out.output_type === "display_data" || out.output_type === "execute_result") {
        const data = out.data || {};

        // PNG images
        if (data["image/png"]) {
            return (
                <div className="p-3 bg-white dark:bg-gray-900">
                    <img
                        src={`data:image/png;base64,${data["image/png"]}`}
                        alt="output"
                        className="max-w-full rounded border border-[var(--border-color)] shadow-sm"
                    />
                </div>
            );
        }

        // HTML output
        if (data["text/html"]) {
            const html = Array.isArray(data["text/html"]) ? data["text/html"].join("") : data["text/html"];
            return (
                <div
                    className="p-3 prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            );
        }

        // Plain text
        if (data["text/plain"]) {
            const text = Array.isArray(data["text/plain"]) ? data["text/plain"].join("") : data["text/plain"];
            return (
                <pre className="p-3 text-sm overflow-auto font-mono text-[var(--text-color)] bg-[var(--background-color)]">
                    <code>{text}</code>
                </pre>
            );
        }

        // JSON output (for complex data)
        if (data["application/json"]) {
            return (
                <pre className="p-3 text-sm overflow-auto font-mono text-[var(--text-color)] bg-[var(--primary-alt-color)]">
                    <code>{JSON.stringify(data["application/json"], null, 2)}</code>
                </pre>
            );
        }
    }

    // Error output with ANSI color support
    if (out.output_type === "error") {
        const traceback = (out.traceback || []).join("\n");

        return (
            <pre className="p-3 text-sm font-mono bg-red-50 dark:bg-red-950/20 border-t border-red-200 dark:border-red-800 overflow-auto">
                <code className="text-red-700 dark:text-red-300">
                    <ErrorName>{out.ename || "Error"}</ErrorName>
                    {out.evalue && <div className="text-red-600 dark:text-red-400 mb-2">{out.evalue}</div>}
                    <ANSIText text={traceback} />
                </code>
            </pre>
        );
    }

    return null;
}

// Helper components for better error display
function ErrorName({ children }: { children: string }) {
    return <span className="font-bold text-red-800 dark:text-red-300">{children}: </span>;
}

// Simple ANSI color conversion for terminal output
function ANSIText({ text }: { text: string }) {
    const processANSI = (str: string) => {
        return str
            .replace(/\u001b\[31m(.*?)\u001b\[0m/g, '<span class="text-ansi-red">$1</span>')
            .replace(/\u001b\[32m(.*?)\u001b\[0m/g, '<span class="text-ansi-green">$1</span>')
            .replace(/\u001b\[33m(.*?)\u001b\[0m/g, '<span class="text-ansi-yellow">$1</span>')
            .replace(/\u001b\[34m(.*?)\u001b\[0m/g, '<span class="text-ansi-blue">$1</span>')
            .replace(/\u001b\[35m(.*?)\u001b\[0m/g, '<span class="text-ansi-magenta">$1</span>')
            .replace(/\u001b\[36m(.*?)\u001b\[0m/g, '<span class="text-ansi-cyan">$1</span>')
            .replace(/\u001b\[1m(.*?)\u001b\[0m/g, '<span class="font-bold">$1</span>');
    };

    return <span dangerouslySetInnerHTML={{ __html: processANSI(text) }} />;
}
