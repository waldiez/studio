/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { useTheme } from "@/theme/hook";
import mermaid from "mermaid";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
    source: string;
    className?: string;
    debounceMs?: number;
};

export default function MermaidViewer({ source, className, debounceMs = 120 }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [error, setError] = useState<string | null>(null);
    const id = useMemo(() => `mmd_${Math.random().toString(36).slice(2)}`, []);
    const theme = useTheme().theme;
    const effectiveTheme = theme === "light" ? "default" : "dark";
    useEffect(() => {
        let alive = true;
        // eslint-disable-next-line max-statements
        const t = setTimeout(async () => {
            if (!alive || !containerRef.current) {
                return;
            }
            try {
                setError(null);
                mermaid.initialize({ startOnLoad: false, theme: effectiveTheme, securityLevel: "strict" });
                const { svg } = await mermaid.render(id, source);
                if (!alive) {
                    return;
                }
                containerRef.current.innerHTML = svg;
                const svgEl = containerRef.current.querySelector("svg");
                if (svgEl) {
                    svgEl.removeAttribute("height");
                    svgEl.setAttribute("width", "100%");
                    (svgEl as SVGElement).style.height = "auto";
                    (svgEl as SVGElement).style.margin = "auto";
                }
            } catch (e: any) {
                setError(String(e?.message || e));
                if (containerRef.current) {
                    containerRef.current.innerHTML = "";
                }
            }
        }, debounceMs);
        return () => {
            alive = false;
            clearTimeout(t);
        };
    }, [source, id, effectiveTheme, debounceMs]);

    return (
        <div className={className ?? "h-full w-full p-2 overflow-auto flex align-middle justify-center"}>
            {error ? (
                <pre className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2 overflow-auto">
                    Mermaid error: {error}
                </pre>
            ) : (
                <div
                    data-testid="mermaid-container"
                    ref={containerRef}
                    className="min-h-12 flex-1 m-auto h-full rounded border border-[var(--border-color)"
                />
            )}
        </div>
    );
}
