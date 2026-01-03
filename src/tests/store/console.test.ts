/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import { type ConsoleLine, pushConsole, useConsole } from "@/store/console";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

describe("useConsole store", () => {
    beforeEach(() => {
        // Clear the store state before each test
        const { result } = renderHook(() => useConsole());
        act(() => {
            result.current.clear();
        });
    });

    it("should initialize with empty lines", () => {
        const { result } = renderHook(() => useConsole());

        expect(result.current.lines).toEqual([]);
    });

    it("should push a new line", () => {
        const { result } = renderHook(() => useConsole());

        const line: ConsoleLine = {
            kind: "stdout",
            text: "Hello World",
            ts: Date.now(),
        };

        act(() => {
            result.current.push(line);
        });

        expect(result.current.lines).toHaveLength(1);
        expect(result.current.lines[0]).toEqual(line);
    });

    it("should push multiple lines in order", () => {
        const { result } = renderHook(() => useConsole());

        const line1: ConsoleLine = {
            kind: "stdout",
            text: "First line",
            ts: Date.now(),
        };

        const line2: ConsoleLine = {
            kind: "stderr",
            text: "Second line",
            ts: Date.now() + 100,
        };

        act(() => {
            result.current.push(line1);
            result.current.push(line2);
        });

        expect(result.current.lines).toHaveLength(2);
        expect(result.current.lines[0]).toEqual(line1);
        expect(result.current.lines[1]).toEqual(line2);
    });

    it("should clear all lines", () => {
        const { result } = renderHook(() => useConsole());

        const line: ConsoleLine = {
            kind: "system",
            text: "Test line",
            ts: Date.now(),
        };

        act(() => {
            result.current.push(line);
        });

        expect(result.current.lines).toHaveLength(1);

        act(() => {
            result.current.clear();
        });

        expect(result.current.lines).toEqual([]);
    });

    it("should handle different line kinds", () => {
        const { result } = renderHook(() => useConsole());

        const stdoutLine: ConsoleLine = {
            kind: "stdout",
            text: "Standard output",
            ts: Date.now(),
        };

        const stderrLine: ConsoleLine = {
            kind: "stderr",
            text: "Error output",
            ts: Date.now(),
        };

        const systemLine: ConsoleLine = {
            kind: "system",
            text: "System message",
            ts: Date.now(),
        };

        act(() => {
            result.current.push(stdoutLine);
            result.current.push(stderrLine);
            result.current.push(systemLine);
        });

        expect(result.current.lines).toHaveLength(3);
        expect(result.current.lines[0].kind).toBe("stdout");
        expect(result.current.lines[1].kind).toBe("stderr");
        expect(result.current.lines[2].kind).toBe("system");
    });

    it("should preserve timestamps", () => {
        const { result } = renderHook(() => useConsole());

        const timestamp = Date.now();
        const line: ConsoleLine = {
            kind: "stdout",
            text: "Timestamped line",
            ts: timestamp,
        };

        act(() => {
            result.current.push(line);
        });

        expect(result.current.lines[0].ts).toBe(timestamp);
    });

    describe("pushConsole helper function", () => {
        it("should push line using helper function", () => {
            const line: ConsoleLine = {
                kind: "stdout",
                text: "Helper function test",
                ts: Date.now(),
            };

            act(() => {
                pushConsole(line);
            });

            const { result } = renderHook(() => useConsole());

            expect(result.current.lines).toHaveLength(1);
            expect(result.current.lines[0]).toEqual(line);
        });

        it("should work independently of hook instances", () => {
            const line1: ConsoleLine = {
                kind: "stdout",
                text: "First helper line",
                ts: Date.now(),
            };

            const line2: ConsoleLine = {
                kind: "stderr",
                text: "Second helper line",
                ts: Date.now() + 100,
            };

            act(() => {
                pushConsole(line1);
            });

            const { result } = renderHook(() => useConsole());

            expect(result.current.lines).toHaveLength(1);

            act(() => {
                pushConsole(line2);
            });

            expect(result.current.lines).toHaveLength(2);
            expect(result.current.lines[0]).toEqual(line1);
            expect(result.current.lines[1]).toEqual(line2);
        });
    });

    describe("state persistence across hook instances", () => {
        it("should maintain state across different hook instances", () => {
            const { result: result1 } = renderHook(() => useConsole());

            const line: ConsoleLine = {
                kind: "stdout",
                text: "Persistent line",
                ts: Date.now(),
            };

            act(() => {
                result1.current.push(line);
            });

            // Create a new hook instance
            const { result: result2 } = renderHook(() => useConsole());

            expect(result2.current.lines).toHaveLength(1);
            expect(result2.current.lines[0]).toEqual(line);
        });

        it("should share state updates between hook instances", () => {
            const { result: result1 } = renderHook(() => useConsole());
            const { result: result2 } = renderHook(() => useConsole());

            const line: ConsoleLine = {
                kind: "system",
                text: "Shared state test",
                ts: Date.now(),
            };

            act(() => {
                result1.current.push(line);
            });

            expect(result2.current.lines).toHaveLength(1);
            expect(result2.current.lines[0]).toEqual(line);

            act(() => {
                result2.current.clear();
            });

            expect(result1.current.lines).toEqual([]);
        });
    });

    describe("ConsoleLine type validation", () => {
        it("should handle empty text", () => {
            const { result } = renderHook(() => useConsole());

            const line: ConsoleLine = {
                kind: "stdout",
                text: "",
                ts: Date.now(),
            };

            act(() => {
                result.current.push(line);
            });

            expect(result.current.lines[0].text).toBe("");
        });

        it("should handle multiline text", () => {
            const { result } = renderHook(() => useConsole());

            const multilineText = "Line 1\nLine 2\nLine 3";
            const line: ConsoleLine = {
                kind: "stderr",
                text: multilineText,
                ts: Date.now(),
            };

            act(() => {
                result.current.push(line);
            });

            expect(result.current.lines[0].text).toBe(multilineText);
        });

        it("should handle special characters in text", () => {
            const { result } = renderHook(() => useConsole());

            const specialText = "Special chars: \\n \\t \\r \" ' & < > 🚀";
            const line: ConsoleLine = {
                kind: "stdout",
                text: specialText,
                ts: Date.now(),
            };

            act(() => {
                result.current.push(line);
            });

            expect(result.current.lines[0].text).toBe(specialText);
        });
    });

    describe("performance considerations", () => {
        it("should handle large number of lines", () => {
            const { result } = renderHook(() => useConsole());

            const lines: ConsoleLine[] = Array.from({ length: 1000 }, (_, i) => ({
                kind: "stdout" as const,
                text: `Line ${i + 1}`,
                ts: Date.now() + i,
            }));

            act(() => {
                // eslint-disable-next-line max-nested-callbacks
                lines.forEach(line => result.current.push(line));
            });

            expect(result.current.lines).toHaveLength(1000);
            expect(result.current.lines[0].text).toBe("Line 1");
            expect(result.current.lines[999].text).toBe("Line 1000");
        });

        it("should clear large number of lines efficiently", () => {
            const { result } = renderHook(() => useConsole());

            // Add many lines
            act(() => {
                for (let i = 0; i < 500; i++) {
                    result.current.push({
                        kind: "stdout",
                        text: `Line ${i}`,
                        ts: Date.now() + i,
                    });
                }
            });

            expect(result.current.lines).toHaveLength(500);

            // Clear should be fast
            act(() => {
                result.current.clear();
            });

            expect(result.current.lines).toEqual([]);
        });
    });
});
