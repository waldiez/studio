/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import ReactMarkdown from "react-markdown";

type Props = {
    source: string;
    className?: string;
    isNotebookCell?: boolean;
};

export default function MarkdownViewer({ source, className }: Props) {
    return (
        <div
            className={className ?? "h-full w-full overflow-auto p-4 prose prose-zinc dark:prose-invert"}
            data-testid="markdown-content"
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                    h1: ({ children }) => (
                        <h1 className="text-xl font-bold mb-3 mt-2 text-[var(--text-color)]">{children}</h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-lg font-semibold mb-2 mt-3 text-[var(--text-color)]">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-base font-medium mb-2 mt-2 text-[var(--text-color)]">
                            {children}
                        </h3>
                    ),
                    h4: ({ children }) => (
                        <h4 className="text-sm font-medium mb-1 mt-2 text-[var(--text-color)]">{children}</h4>
                    ),
                    p: ({ children }) => (
                        <p className="mb-3 text-[var(--text-color)] leading-relaxed">{children}</p>
                    ),
                    ul: ({ children }) => (
                        <ul className="mb-3 ml-4 list-disc text-[var(--text-color)]">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="mb-3 ml-4 list-decimal text-[var(--text-color)]">{children}</ol>
                    ),
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-[var(--primary-color)] pl-4 my-3 italic text-[var(--text-color)] opacity-90">
                            {children}
                        </blockquote>
                    ),
                    code: ({ children, className, ...props }) => {
                        const isInline = !className;

                        if (isInline) {
                            return (
                                <code className="markdown-inline-code" {...props}>
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code className={`markdown-code ${className || ""}`} {...props}>
                                {children}
                            </code>
                        );
                    },
                    pre: ({ children }) => (
                        <pre className="mb-3 p-3 bg-[var(--primary-alt-color)] rounded border border-[var(--border-color)] overflow-x-auto">
                            {children}
                        </pre>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-semibold text-[var(--text-color)]">{children}</strong>
                    ),
                    em: ({ children }) => <em className="italic text-[var(--text-color)]">{children}</em>,
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            className="text-[var(--primary-color)] hover:text-[var(--primary-color-hover)] underline"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {children}
                        </a>
                    ),
                    table: ({ children }) => (
                        <div className="mb-3 overflow-x-auto">
                            <table className="min-w-full border border-[var(--border-color)] rounded">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-[var(--primary-alt-color)]">{children}</thead>
                    ),
                    th: ({ children }) => (
                        <th className="px-3 py-2 text-left border-b border-[var(--border-color)] font-medium text-[var(--text-color)]">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="px-3 py-2 border-b border-[var(--border-color)] text-[var(--text-color)]">
                            {children}
                        </td>
                    ),
                    hr: () => <hr className="my-4 border-[var(--border-color)]" />,
                }}
            >
                {source}
            </ReactMarkdown>
        </div>
    );
}
