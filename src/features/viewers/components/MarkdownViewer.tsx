/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import hljs from "highlight.js";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import Marked from "marked-react";

import { type JSX, useMemo } from "react";

type Props = {
    source: string;
    className?: string;
    isNotebookCell?: boolean;
};

// Configure marked once (global)
marked.use(
    markedHighlight({
        highlight(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
    }),
);

export default function MarkdownViewer({ source, className }: Props) {
    const cleaned = useMemo(() => source.replace(/<!--[\s\S]*?-->/g, ""), [source]);
    return (
        <div
            className={className ?? "h-full w-full overflow-auto p-4 prose prose-zinc dark:prose-invert"}
            data-testid="markdown-content"
        >
            <Marked
                value={cleaned}
                gfm={true}
                breaks={false}
                renderer={{
                    heading(children, level) {
                        const Tag = `h${level}` as unknown as keyof JSX.IntrinsicElements;
                        const base =
                            level === 1
                                ? "text-xl font-bold mb-3 mt-2"
                                : level === 2
                                  ? "text-lg font-semibold mb-2 mt-3"
                                  : level === 3
                                    ? "text-base font-medium mb-2 mt-2"
                                    : "text-sm font-medium mb-1 mt-2";
                        return <Tag className={`${base} text-[var(--text-color)]`}>{children}</Tag>;
                    },
                    paragraph(text) {
                        return <p className="mb-3 text-[var(--text-color)] leading-relaxed">{text}</p>;
                    },
                    blockquote(quote) {
                        return (
                            <blockquote className="border-l-4 border-[var(--primary-color)] pl-4 my-3 italic text-[var(--text-color)] opacity-90">
                                {quote}
                            </blockquote>
                        );
                    },
                    codespan(code) {
                        return <code className="markdown-inline-code">{code}</code>;
                    },
                    code(code, lang) {
                        return (
                            <pre className="mb-3 p-3 bg-[var(--primary-alt-color)] rounded border border-[var(--border-color)] overflow-x-auto">
                                <code className={`markdown-code language-${lang || ""}`}>{code}</code>
                            </pre>
                        );
                    },
                    strong(text) {
                        return <strong className="font-semibold text-[var(--text-color)]">{text}</strong>;
                    },
                    em(text) {
                        return <em className="italic text-[var(--text-color)]">{text}</em>;
                    },
                    link(href, text) {
                        return (
                            <a
                                href={href || ""}
                                className="text-[var(--primary-color)] hover:text-[var(--primary-color-hover)] underline"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {text}
                            </a>
                        );
                    },
                    hr() {
                        return <hr className="my-4 border-[var(--border-color)]" />;
                    },
                    html(raw: unknown) {
                        // Normalize to string
                        const html =
                            typeof raw === "string"
                                ? raw
                                : Array.isArray(raw)
                                  ? raw.join("")
                                  : "" + (raw as any);

                        if (!html.trim()) {
                            return null;
                        }
                        const isBlock =
                            /^\s*<(table|div|section|article|ul|ol|pre|blockquote|h[1-6]|p|img|figure|thead|tbody|tr|td|th)\b/i.test(
                                html,
                            );
                        const Wrapper = isBlock ? "div" : "span";

                        return (
                            <Wrapper className="markdown-html" dangerouslySetInnerHTML={{ __html: html }} />
                        );
                    },
                }}
            />
        </div>
    );
}
