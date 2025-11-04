/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
/* eslint-disable max-statements */
import { useTheme } from "@/theme/hook";
import { RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import mermaid from "mermaid";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
    source: string;
    className?: string;
    debounceMs?: number;
    minScale?: number;
    maxScale?: number;
};

export default function MermaidViewer({
    source,
    className,
    debounceMs = 120,
    minScale = 0.4,
    maxScale = 4,
}: Props) {
    const outerRef = useRef<HTMLDivElement | null>(null);
    const innerRef = useRef<HTMLDivElement | null>(null);
    const [error, setError] = useState<string | null>(null);

    const id = useMemo(() => `mmd_${Math.random().toString(36).slice(2)}`, []);
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const theme = useTheme().theme;
    const effectiveTheme = theme === "light" ? "default" : "dark";

    // Zoom state
    const scaleRef = useRef(1);
    const positionRef = useRef({ x: 0, y: 0 });
    const draggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    const zoomAtClientPoint = useCallback(
        (clientX: number, clientY: number, nextScale: number) => {
            const outer = outerRef.current;
            if (!outer) {
                return;
            }
            const rect = outer.getBoundingClientRect();
            const s0 = scaleRef.current;
            const { x: tx0, y: ty0 } = positionRef.current;
            const px = clientX - rect.left;
            const py = clientY - rect.top;
            const wx = (px - tx0) / s0;
            const wy = (py - ty0) / s0;
            const s1 = clamp(nextScale, minScale, maxScale);
            const tx1 = px - wx * s1;
            const ty1 = py - wy * s1;
            scaleRef.current = s1;
            positionRef.current = { x: tx1, y: ty1 };
            applyTransform();
        },
        [minScale, maxScale],
    );

    const applyTransform = () => {
        if (!innerRef.current) {
            return;
        }
        const { x, y } = positionRef.current;
        const s = scaleRef.current;
        innerRef.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    };

    const resetTransform = useCallback(() => {
        scaleRef.current = 1;
        positionRef.current = { x: 0, y: 0 };
        applyTransform();
    }, []);

    useEffect(() => {
        let alive = true;
        const t = setTimeout(async () => {
            if (!alive || !innerRef.current) {
                return;
            }

            try {
                setError(null);
                mermaid.initialize({
                    startOnLoad: false,
                    theme: effectiveTheme,
                    securityLevel: "strict",
                });
                const { svg } = await mermaid.render(id, source);

                if (!alive) {
                    return;
                }
                innerRef.current.innerHTML = svg;

                const svgEl = innerRef.current.querySelector("svg");
                if (svgEl) {
                    svgEl.removeAttribute("height");
                    svgEl.setAttribute("width", "100%");
                    (svgEl as SVGElement).style.height = "auto";
                    (svgEl as SVGElement).style.margin = "auto";
                    (svgEl as SVGElement).style.userSelect = "none";
                    (svgEl as SVGElement).style.webkitUserSelect = "none";
                }

                // Reset zoom when diagram changes
                resetTransform();
            } catch (e: any) {
                setError(e?.message || String(e));
                innerRef.current.innerHTML = "";
            }
        }, debounceMs);

        return () => {
            alive = false;
            clearTimeout(t);
        };
    }, [source, id, effectiveTheme, debounceMs, resetTransform]);

    // Zoom handlers
    useEffect(() => {
        const el = outerRef.current;
        if (!el) {
            return;
        }

        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) {
                return; // don't hijack normal scroll
            }
            e.preventDefault();
            const delta = -e.deltaY * 0.0015;
            const targetScale = scaleRef.current + delta;
            zoomAtClientPoint(e.clientX, e.clientY, targetScale);
        };

        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) {
                return;
            }
            draggingRef.current = true;
            dragStartRef.current = { x: e.clientX, y: e.clientY };
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!draggingRef.current) {
                return;
            }
            const dx = e.clientX - dragStartRef.current.x;
            const dy = e.clientY - dragStartRef.current.y;

            positionRef.current.x += dx;
            positionRef.current.y += dy;
            dragStartRef.current = { x: e.clientX, y: e.clientY };

            applyTransform();
        };

        const onMouseUp = () => (draggingRef.current = false);

        el.addEventListener("wheel", onWheel, { passive: false });
        el.addEventListener("mousedown", onMouseDown);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        return () => {
            el.removeEventListener("wheel", onWheel);
            el.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [zoomAtClientPoint]);

    return (
        <div className={className ?? "h-full w-full p-2 overflow-hidden flex justify-center select-none"}>
            {error ? (
                <pre className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2 overflow-auto">
                    Mermaid error: {error}
                </pre>
            ) : (
                <div
                    ref={outerRef}
                    className="min-h-12 flex-1 m-auto h-full rounded overflow-hidden relative cursor-grab active:cursor-grabbing
                               border border-[var(--border-color)] bg-[var(--primary-alt-color)] select-none"
                    data-testid="mermaid-container"
                >
                    <div
                        ref={innerRef}
                        className="w-full h-full origin-top-left transition-transform duration-75 ease-out select-none"
                    />
                    {/* Zoom controls */}
                    <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 select-none">
                        <button
                            type="button"
                            aria-label="Zoom in"
                            title="Zoom in"
                            onClick={() => {
                                const outer = outerRef.current;
                                if (!outer) {
                                    return;
                                }
                                const r = outer.getBoundingClientRect();
                                zoomAtClientPoint(
                                    r.left + r.width / 2,
                                    r.top + r.height / 2,
                                    scaleRef.current + 0.2,
                                );
                            }}
                            className="rounded-md border p-2 bg-[var(--background-color)]/90 backdrop-blur shadow
                                       hover:bg-[var(--background-color)] active:scale-95 border-[var(--border-color)] select-none"
                        >
                            <ZoomIn className="h-4 w-4" />
                        </button>

                        <button
                            type="button"
                            aria-label="Zoom out"
                            title="Zoom out"
                            onClick={() => {
                                const outer = outerRef.current;
                                if (!outer) {
                                    return;
                                }
                                const r = outer.getBoundingClientRect();
                                zoomAtClientPoint(
                                    r.left + r.width / 2,
                                    r.top + r.height / 2,
                                    scaleRef.current - 0.2,
                                );
                            }}
                            className="rounded-md border p-2 bg-[var(--background-color)]/90 backdrop-blur shadow
                                       hover:bg-[var(--background-color)] active:scale-95 border-[var(--border-color)] select-none"
                        >
                            <ZoomOut className="h-4 w-4" />
                        </button>

                        <button
                            type="button"
                            aria-label="Reset zoom"
                            title="Reset zoom"
                            onClick={() => {
                                resetTransform();
                            }}
                            className="rounded-md border p-2 bg-[var(--background-color)]/90 backdrop-blur shadow
                                       hover:bg-[var(--background-color)] active:scale-95 border-[var(--border-color)] select-none"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
