/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { type TermController, openTerminal } from "@/lib/wsTerminal";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { SearchAddon } from "xterm-addon-search";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";

import { useCallback, useEffect, useRef } from "react";

import { useXtermTheme } from "../hooks/useXtermTheme";

export default function Terminal({ cwd }: { cwd?: string }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const termRef = useRef<XTerm | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const ctrlRef = useRef<TermController | null>(null);
    const dataDisposableRef = useRef<{ dispose(): void } | null>(null);
    const mountedRef = useRef(true);
    const rafRef = useRef<number | null>(null);
    const ioRef = useRef<IntersectionObserver | null>(null);

    // Schedule a fit + PTY resize on the next animation frame (after layout)
    const scheduleResize = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = requestAnimationFrame(() => {
            const term = termRef.current;
            const fit = fitRef.current;
            const ctrl = ctrlRef.current;
            const el = containerRef.current;
            if (!term || !fit || !ctrl || !el) {
                return;
            }

            // Only fit if we actually have space (avoid 0x0 or hidden)
            const rect = el.getBoundingClientRect();
            if (rect.width < 4 || rect.height < 4) {
                return;
            }

            fit.fit();

            const rows = term.rows;
            const cols = term.cols;
            ctrl.resize(rows, cols);
        });
    }, []);

    // Create xterm once
    // eslint-disable-next-line max-statements
    useEffect(() => {
        mountedRef.current = true;

        const term = new XTerm({
            fontSize: 12,
            convertEol: true,
            cursorBlink: true,
            scrollback: 8000,
            lineHeight: 1.2,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.loadAddon(new WebLinksAddon());
        term.loadAddon(new SearchAddon());

        termRef.current = term;
        fitRef.current = fit;

        if (containerRef.current) {
            term.open(containerRef.current);
            fit.fit();
        }

        // Send typed keys to server
        dataDisposableRef.current = term.onData(data => {
            ctrlRef.current?.send(data);
        });

        // Resize when container geometry changes
        const ro = new ResizeObserver(() => scheduleResize());
        if (containerRef.current) {
            ro.observe(containerRef.current);
            // Also observe parent; panel/tab wrappers often dictate size
            containerRef.current.parentElement && ro.observe(containerRef.current.parentElement);
        }

        // Re-fit when fonts are ready (theme/font swap can change metrics)
        if ("fonts" in document) {
            (document as any).fonts?.ready?.then(() => scheduleResize());
        }
        // And on window resizes/zoom
        const onWinResize = () => scheduleResize();
        window.addEventListener("resize", onWinResize);

        // Re-fit when the element becomes visible (Tabs switch from display:none)
        if (containerRef.current && "IntersectionObserver" in window) {
            ioRef.current = new IntersectionObserver(
                entries => {
                    const visible = entries.some(e => e.isIntersecting && e.intersectionRatio > 0);
                    if (visible) {
                        scheduleResize();
                    }
                },
                { root: null, threshold: [0, 0.01, 0.5, 1] },
            );
            ioRef.current.observe(containerRef.current);
        }

        // Do an initial resize after the element has actually painted
        scheduleResize();

        return () => {
            mountedRef.current = false;
            window.removeEventListener("resize", onWinResize);
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
            ioRef.current?.disconnect();
            ro.disconnect();
            dataDisposableRef.current?.dispose();
            ctrlRef.current?.close();
            ctrlRef.current = null;
            term.dispose();
            termRef.current = null;
            fitRef.current = null;
        };
    }, [scheduleResize]);

    // Theme (colors)
    useXtermTheme(termRef);

    // WS control
    const makeCtrl = useCallback(
        (): TermController =>
            openTerminal(
                cwd,
                chunk => termRef.current?.write(chunk),
                () => {
                    // server ended the session
                    termRef.current?.write("\r\n\x1b[33m[session ended]\x1b[0m\r\n");
                    // Tear down old controller first
                    ctrlRef.current?.close();
                    ctrlRef.current = null;

                    // small delay to let server finish closing
                    setTimeout(() => {
                        if (!mountedRef.current) {
                            return;
                        }
                        // Clear the screen and scrollback
                        termRef.current?.reset?.();
                        // Create a fresh session
                        ctrlRef.current = makeCtrl();
                        // And ensure the new PTY gets correct size
                        scheduleResize();
                    }, 150);
                },
            ),
        [cwd, scheduleResize],
    );

    // Connect WS whenever cwd changes (or on mount)
    useEffect(() => {
        ctrlRef.current?.close();
        ctrlRef.current = null;

        const next = makeCtrl();
        ctrlRef.current = next;

        // Initial size after connect
        const id = setTimeout(() => scheduleResize(), 60);
        return () => {
            clearTimeout(id);
            next.close();
            if (ctrlRef.current === next) {
                ctrlRef.current = null;
            }
        };
    }, [cwd, makeCtrl, scheduleResize]);

    return <div ref={containerRef} className="h-full w-full min-h-0 min-w-0 overflow-hidden" />;
}
