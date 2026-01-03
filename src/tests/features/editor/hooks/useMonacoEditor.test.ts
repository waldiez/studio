/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import { useEditorOptions } from "@/features/editor/hooks/useMonacoEditor";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("useEditorOptions", () => {
    it("returns default editor options", () => {
        const { result } = renderHook(() => useEditorOptions());

        expect(result.current).toEqual({
            fontSize: 13,
            fontLigatures: true,
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            renderWhitespace: "selection",
            wordWrap: "on",
            tabSize: 4,
            cursorBlinking: "smooth",
        });
    });

    it("merges overrides with defaults", () => {
        const overrides = {
            fontSize: 16,
            minimap: { enabled: true },
            readOnly: true,
        };

        const { result } = renderHook(() => useEditorOptions(overrides));

        expect(result.current).toEqual({
            fontSize: 16,
            fontLigatures: true,
            minimap: { enabled: true },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            renderWhitespace: "selection",
            wordWrap: "on",
            tabSize: 4,
            cursorBlinking: "smooth",
            readOnly: true,
        });
    });

    it("overrides can replace nested objects", () => {
        const overrides = {
            minimap: { enabled: true, scale: 2 },
        };

        const { result } = renderHook(() => useEditorOptions(overrides));

        expect(result.current.minimap).toEqual({ enabled: true, scale: 2 });
    });

    it("handles empty overrides object", () => {
        const { result } = renderHook(() => useEditorOptions({}));

        expect(result.current.fontSize).toBe(13);
        expect(result.current.fontLigatures).toBe(true);
    });

    it("handles undefined overrides", () => {
        const { result } = renderHook(() => useEditorOptions(undefined));

        expect(result.current.fontSize).toBe(13);
        expect(result.current.minimap.enabled).toBe(false);
    });

    it("memoizes result when overrides don't change", () => {
        const overrides = { fontSize: 14 };
        const { result, rerender } = renderHook(() => useEditorOptions(overrides));

        const firstResult = result.current;
        rerender();
        const secondResult = result.current;

        expect(firstResult).toBe(secondResult);
    });

    it("returns new object when overrides change", () => {
        const { result, rerender } = renderHook(({ overrides }) => useEditorOptions(overrides), {
            initialProps: { overrides: { fontSize: 14 } },
        });

        const firstResult = result.current;

        rerender({ overrides: { fontSize: 16 } });
        const secondResult = result.current;

        expect(firstResult).not.toBe(secondResult);
        expect(firstResult.fontSize).toBe(14);
        expect(secondResult.fontSize).toBe(16);
    });

    it("handles all common editor options", () => {
        const overrides = {
            readOnly: true,
            theme: "vs-dark",
            language: "typescript",
            wordWrap: "off" as const,
            lineNumbers: "on" as const,
        };

        const { result } = renderHook(() => useEditorOptions(overrides));

        expect(result.current).toMatchObject(overrides);
    });
});
