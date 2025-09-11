/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { codeToHtml } from "@/lib/highlighter";
import { useTheme } from "@/theme/hook";

import { useEffect, useState } from "react";

export default function CodeBlock({
    code,
    lang = "python",
    className,
}: {
    code: string;
    lang?: string;
    className?: string;
}) {
    const { theme } = useTheme();
    const effectiveTheme = theme === "light" ? "light" : "dark";
    const [html, setHtml] = useState<string>("");

    useEffect(() => {
        let alive = true;
        (async () => {
            const out = await codeToHtml(code, lang, effectiveTheme);
            if (alive) {
                setHtml(out);
            }
        })();
        return () => {
            alive = false;
        };
    }, [code, lang, effectiveTheme]);

    return (
        <div
            className={className ?? "overflow-auto rounded border border-[var(--border-color)]"}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
