/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";

import { useMemo } from "react";

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
    const html = useMemo(() => {
        const cleaned = source.replace(/<!--[\s\S]*?-->/g, "");
        const rawHtml = marked.parse(cleaned, { async: false });
        return DOMPurify.sanitize(rawHtml, {
            ALLOWED_TAGS: [
                "h1",
                "h2",
                "h3",
                "h4",
                "h5",
                "h6",
                "p",
                "br",
                "hr",
                "strong",
                "em",
                "b",
                "i",
                "u",
                "s",
                "del",
                "mark",
                "a",
                "img",
                "ul",
                "ol",
                "li",
                "blockquote",
                "pre",
                "code",
                "table",
                "thead",
                "tbody",
                "tfoot",
                "tr",
                "th",
                "td",
                "div",
                "span",
                "input", // for task list checkboxes
            ],
            ALLOWED_ATTR: [
                "href",
                "src",
                "alt",
                "title",
                "class",
                "id",
                "target",
                "rel",
                "type",
                "checked",
                "disabled",
                "align",
                "size",
                "width",
                "height",
                "colspan",
            ],
            ALLOWED_URI_REGEXP:
                // eslint-disable-next-line no-useless-escape
                /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data|waldiez):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
            KEEP_CONTENT: true,
            RETURN_TRUSTED_TYPE: false,
        });
    }, [source]);
    return (
        <div
            className={
                className ??
                "h-full w-full overflow-auto p-4 prose prose-zinc dark:prose-invert markdown-content"
            }
            data-testid="markdown-content"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
