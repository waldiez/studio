/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import { useDebouncedCallback } from "@/utils/debounce";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("useDebouncedCallback", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it("should debounce function calls", () => {
        const mockFn = vi.fn();
        const { result } = renderHook(() => useDebouncedCallback(mockFn, 500));

        // Call multiple times quickly
        act(() => {
            result.current("arg1");
            result.current("arg2");
            result.current("arg3");
        });

        // Should not have called the function yet
        expect(mockFn).not.toHaveBeenCalled();

        // Advance time by less than delay
        act(() => {
            vi.advanceTimersByTime(300);
        });

        // Still should not have called
        expect(mockFn).not.toHaveBeenCalled();

        // Advance time past delay
        act(() => {
            vi.advanceTimersByTime(200);
        });

        // Should have called with last arguments
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith("arg3");
    });

    it("should restart timer on new calls", () => {
        const mockFn = vi.fn();
        const { result } = renderHook(() => useDebouncedCallback(mockFn, 500));

        // First call
        act(() => {
            result.current("first");
        });

        // Advance time partially
        act(() => {
            vi.advanceTimersByTime(300);
        });

        // Second call should restart timer
        act(() => {
            result.current("second");
        });

        // Advance time by original delay
        act(() => {
            vi.advanceTimersByTime(500);
        });

        // Should only call once with latest arguments
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith("second");
    });

    it("should use latest function reference", () => {
        const mockFn1 = vi.fn();
        const mockFn2 = vi.fn();

        const { result, rerender } = renderHook(({ fn }) => useDebouncedCallback(fn, 500), {
            initialProps: { fn: mockFn1 },
        });

        // Call with first function
        act(() => {
            result.current("test");
        });

        // Update to second function
        rerender({ fn: mockFn2 });

        // Execute the timer
        act(() => {
            vi.advanceTimersByTime(500);
        });

        // Should call the latest function
        expect(mockFn1).not.toHaveBeenCalled();
        expect(mockFn2).toHaveBeenCalledWith("test");
    });

    it("should handle multiple arguments", () => {
        const mockFn = vi.fn();
        const { result } = renderHook(() => useDebouncedCallback(mockFn, 300));

        act(() => {
            result.current("arg1", "arg2", 123, { key: "value" });
        });

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(mockFn).toHaveBeenCalledWith("arg1", "arg2", 123, { key: "value" });
    });

    it("should handle zero delay", () => {
        const mockFn = vi.fn();
        const { result } = renderHook(() => useDebouncedCallback(mockFn, 0));

        act(() => {
            result.current("test");
        });

        act(() => {
            vi.advanceTimersByTime(0);
        });

        expect(mockFn).toHaveBeenCalledWith("test");
    });

    it("should clean up timer on unmount", () => {
        const mockFn = vi.fn();
        const { result, unmount } = renderHook(() => useDebouncedCallback(mockFn, 500));

        act(() => {
            result.current("test");
        });

        // Unmount before timer executes
        unmount();

        act(() => {
            vi.advanceTimersByTime(500);
        });

        // Function should not be called after unmount
        expect(mockFn).not.toHaveBeenCalled();
    });

    it("should handle delay changes", () => {
        const mockFn = vi.fn();
        const { result, rerender } = renderHook(({ delay }) => useDebouncedCallback(mockFn, delay), {
            initialProps: { delay: 500 },
        });

        act(() => {
            result.current("test1");
        });

        // Change delay
        rerender({ delay: 200 });

        act(() => {
            result.current("test2");
        });

        // Advance by new delay
        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(mockFn).toHaveBeenCalledWith("test2");
    });

    it("should create stable debounced function reference when delay doesn't change", () => {
        const mockFn = vi.fn();
        const { result, rerender } = renderHook(() => useDebouncedCallback(mockFn, 500));

        const firstReference = result.current;

        // Rerender without changing delay
        rerender();

        const secondReference = result.current;

        // Should be the same reference
        expect(firstReference).toBe(secondReference);
    });

    it("should create new debounced function reference when delay changes", () => {
        const mockFn = vi.fn();
        const { result, rerender } = renderHook(({ delay }) => useDebouncedCallback(mockFn, delay), {
            initialProps: { delay: 500 },
        });

        const firstReference = result.current;

        // Change delay
        rerender({ delay: 300 });

        const secondReference = result.current;

        // Should be different references
        expect(firstReference).not.toBe(secondReference);
    });

    it("should handle rapid successive calls correctly", () => {
        const mockFn = vi.fn();
        const { result } = renderHook(() => useDebouncedCallback(mockFn, 100));

        // Make 10 rapid calls
        act(() => {
            for (let i = 0; i < 10; i++) {
                result.current(`call-${i}`);
            }
        });

        // Advance time
        act(() => {
            vi.advanceTimersByTime(100);
        });

        // Should only call once with the last argument
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith("call-9");
    });
});
