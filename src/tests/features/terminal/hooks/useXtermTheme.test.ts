/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { useXtermTheme } from "@/features/terminal/hooks/useXtermTheme";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- Hoisted theme state + mock ----
const themeState = vi.hoisted(() => ({ theme: "light" as "light" | "dark" | "system" }));
vi.mock("@/theme/hook", () => ({
    useTheme: () => themeState,
}));

type CssMap = Record<string, string>;
const cssMapBody: CssMap = {};
const cssMapRoot: CssMap = {};

let rafSpy: ReturnType<typeof vi.spyOn>;
let cafSpy: any;
let gcsSpy: ReturnType<typeof vi.spyOn>;

describe("useXtermTheme", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // default CSS variables
        Object.assign(cssMapBody, {
            "--text-color": "#111111",
            "--background-color": "#ffffff",
            "--primary-color": "#3399ff",
            "--ansi-black": "#000000",
            "--ansi-red": "#ff0000",
            "--ansi-green": "#00ff00",
            "--ansi-yellow": "#cccc00",
            "--ansi-blue": "#0000ff",
            "--ansi-magenta": "#ff00ff",
            "--ansi-cyan": "#00ffff",
            "--ansi-white": "#f0f0f0",
        });
        Object.assign(cssMapRoot, {
            "--ansi-bright-yellow": "#ffff00",
        });

        themeState.theme = "light";

        gcsSpy = vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element) => {
            const src = el === document.body ? cssMapBody : cssMapRoot;
            return {
                getPropertyValue: (name: string) => src[name] ?? "",
            } as any;
        });
        let id = 0;
        rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
            id += 1;
            cb(performance.now());
            return id as any;
        });
        cafSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    });

    afterEach(() => {
        rafSpy.mockRestore();
        cafSpy.mockRestore();
        gcsSpy.mockRestore();
    });

    it("applies theme and refreshes terminal on mount", () => {
        const term = makeMockTerm(24);
        const ref = { current: term };

        renderHook(() => useXtermTheme(ref));

        // Two nested RAFs
        expect(rafSpy).toHaveBeenCalledTimes(2);

        expect(term.options.theme).toEqual({
            foreground: "#111111",
            background: "#ffffff",
            cursor: "#111111",
            cursorAccent: "#ffffff",
            selectionBackground: "#3399ff",
            black: "#000000",
            red: "#ff0000",
            green: "#00ff00",
            yellow: "#cccc00",
            blue: "#0000ff",
            magenta: "#ff00ff",
            cyan: "#00ffff",
            white: "#f0f0f0",
            brightBlack: "#000000",
            brightRed: "#ff0000",
            brightGreen: "#00ff00",
            brightYellow: "#ffff00",
            brightBlue: "#0000ff",
            brightMagenta: "#ff00ff",
            brightCyan: "#00ffff",
            brightWhite: "#f0f0f0",
        });
        expect(term.refresh).toHaveBeenCalledWith(0, 23);
    });

    it("cancels both animation frames on unmount", () => {
        const term = makeMockTerm(30);
        const ref = { current: term };

        const { unmount } = renderHook(() => useXtermTheme(ref));
        expect(rafSpy).toHaveBeenCalledTimes(2);

        unmount();

        // We don’t assert specific IDs—just that cancel was called twice
        expect(cafSpy).toHaveBeenCalledTimes(2);
    });

    it("does nothing when termRef.current is null", () => {
        const ref = { current: null };
        renderHook(() => useXtermTheme(ref));

        expect(rafSpy).not.toHaveBeenCalled();
        expect(cafSpy).not.toHaveBeenCalled();
    });

    it("re-applies theme when the app theme changes (and picks up updated CSS vars)", () => {
        const term = makeMockTerm(10);
        const ref = { current: term };

        const { rerender } = renderHook(() => useXtermTheme(ref));
        expect(rafSpy).toHaveBeenCalledTimes(2);
        expect(term.refresh).toHaveBeenCalledTimes(1);

        cssMapBody["--text-color"] = "#222222";
        cssMapBody["--background-color"] = "#eeeeee";
        themeState.theme = "dark";

        act(() => {
            rerender();
        });

        // Two more nested RAFs
        expect(rafSpy).toHaveBeenCalledTimes(4);
        expect(term.refresh).toHaveBeenCalledTimes(2);
        expect(term.options.theme?.foreground).toBe("#222222");
        expect(term.options.theme?.background).toBe("#eeeeee");
    });
});

// helper
function makeMockTerm(rows: number) {
    return {
        rows,
        options: {} as { theme?: any },
        refresh: vi.fn(),
    } as unknown as import("xterm").Terminal;
}
