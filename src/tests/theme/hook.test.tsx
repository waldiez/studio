/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { ThemeProviderContext } from "@/theme/context";
import { useTheme } from "@/theme/hook";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { type ReactNode } from "react";

describe("useTheme", () => {
    it("should throw error when used outside ThemeProvider", () => {
        // Capture console.error to avoid test noise
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        expect(() => {
            renderHook(() => useTheme());
        }).toThrow("useTheme must be used within a ThemeProvider");

        consoleSpy.mockRestore();
    });

    it("should return context value when used within provider", () => {
        const mockContextValue = {
            theme: "dark" as const,
            setTheme: vi.fn(),
            toggle: vi.fn(),
        };

        const wrapper = ({ children }: { children: ReactNode }) => (
            <ThemeProviderContext.Provider value={mockContextValue}>{children}</ThemeProviderContext.Provider>
        );

        const { result } = renderHook(() => useTheme(), { wrapper });

        expect(result.current).toBe(mockContextValue);
        expect(result.current.theme).toBe("dark");
        expect(result.current.setTheme).toBe(mockContextValue.setTheme);
        expect(result.current.toggle).toBe(mockContextValue.toggle);
    });

    it("should return updated context value when context changes", () => {
        let mockContextValue = {
            theme: "light" as any,
            setTheme: vi.fn(),
            toggle: vi.fn(),
        };

        const wrapper = ({ children }: { children: ReactNode }) => (
            <ThemeProviderContext.Provider value={mockContextValue}>{children}</ThemeProviderContext.Provider>
        );

        const { result, rerender } = renderHook(() => useTheme(), { wrapper });

        expect(result.current.theme).toBe("light");

        // Update the context value
        mockContextValue = {
            theme: "dark" as any,
            setTheme: vi.fn(),
            toggle: vi.fn(),
        };

        rerender();

        expect(result.current.theme).toBe("dark");
    });

    it("should maintain function references when context updates", () => {
        const setThemeFn = vi.fn();
        const toggleFn = vi.fn();

        const mockContextValue = {
            theme: "system" as const,
            setTheme: setThemeFn,
            toggle: toggleFn,
        };

        const wrapper = ({ children }: { children: ReactNode }) => (
            <ThemeProviderContext.Provider value={mockContextValue}>{children}</ThemeProviderContext.Provider>
        );

        const { result } = renderHook(() => useTheme(), { wrapper });

        expect(result.current.setTheme).toBe(setThemeFn);
        expect(result.current.toggle).toBe(toggleFn);

        // Verify functions can be called
        result.current.setTheme("dark");
        result.current.toggle();

        expect(setThemeFn).toHaveBeenCalledWith("dark");
        expect(toggleFn).toHaveBeenCalled();
    });
});
