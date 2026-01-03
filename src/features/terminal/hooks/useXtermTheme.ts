/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import { useTheme } from "@/theme/hook";
import type { ITheme, Terminal } from "xterm";

import { useEffect } from "react";

function css(name: string): string | undefined {
    // Prefer body (body.waldiez-{dark,light})
    const bodyVal = getComputedStyle(document.body).getPropertyValue(name).trim();
    if (bodyVal) {
        return bodyVal;
    }
    const rootVal = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return rootVal || undefined;
}
function buildTheme(): ITheme {
    const fg = css("--text-color");
    const bg = css("--background-color");
    return {
        foreground: fg,
        background: bg,
        cursor: fg,
        cursorAccent: bg,
        selectionBackground: css("--primary-color"),
        black: css("--ansi-black"),
        red: css("--ansi-red"),
        green: css("--ansi-green"),
        yellow: css("--ansi-yellow"),
        blue: css("--ansi-blue"),
        magenta: css("--ansi-magenta"),
        cyan: css("--ansi-cyan"),
        white: css("--ansi-white"),
        brightBlack: css("--ansi-black"),
        brightRed: css("--ansi-red"),
        brightGreen: css("--ansi-green"),
        brightYellow: css("--ansi-bright-yellow") ?? css("--ansi-yellow"),
        brightBlue: css("--ansi-blue"),
        brightMagenta: css("--ansi-magenta"),
        brightCyan: css("--ansi-cyan"),
        brightWhite: css("--ansi-white"),
    };
}

/** Apply theme whenever the app theme changes (reads the ref each time). */
export function useXtermTheme(termRef: React.RefObject<Terminal | null>) {
    const { theme } = useTheme(); // "light" | "dark" | "system"

    useEffect(() => {
        const term = termRef.current;
        if (!term) {
            return;
        }
        let raf1 = 0;
        let raf2 = 0;
        raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => {
                const next = buildTheme();

                term.options.theme = next;
                try {
                    term.refresh(0, term.rows - 1);
                } catch {
                    /* no-op */
                }
            });
        });

        return () => {
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(raf2);
        };
    }, [termRef, theme]);
}
