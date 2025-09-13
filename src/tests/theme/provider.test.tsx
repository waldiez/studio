/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { useTheme } from "@/theme/hook";
import { ThemeProvider } from "@/theme/provider";
import { act, render, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ReactNode } from "react";

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock matchMedia
const matchMediaMock = vi.fn();
Object.defineProperty(window, "matchMedia", { value: matchMediaMock });

describe("ThemeProvider", () => {
    beforeEach(() => {
        // Reset mocks
        localStorageMock.getItem.mockReset();
        localStorageMock.setItem.mockReset();
        matchMediaMock.mockReset();

        // Mock document elements
        document.documentElement.classList.remove = vi.fn();
        document.documentElement.classList.add = vi.fn();
        document.documentElement.classList.toggle = vi.fn();
        document.body.classList.toggle = vi.fn();
        document.body.classList.remove = vi.fn();
        document.body.classList.add = vi.fn();

        // Default matchMedia mock
        matchMediaMock.mockReturnValue({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });
    });

    describe("initialization", () => {
        it("should use theme from localStorage when available", () => {
            localStorageMock.getItem.mockReturnValue("dark");

            const TestComponent = () => {
                const { theme } = useTheme();
                return <div data-testid="theme">{theme}</div>;
            };

            const { getByTestId } = render(
                <ThemeProvider>
                    <TestComponent />
                </ThemeProvider>,
            );

            expect(getByTestId("theme")).toHaveTextContent("dark");
            expect(localStorageMock.getItem).toHaveBeenCalledWith("waldiez-theme");
        });

        it("should use defaultTheme when localStorage is empty", () => {
            localStorageMock.getItem.mockReturnValue(null);

            const TestComponent = () => {
                const { theme } = useTheme();
                return <div data-testid="theme">{theme}</div>;
            };

            const { getByTestId } = render(
                <ThemeProvider defaultTheme="light">
                    <TestComponent />
                </ThemeProvider>,
            );

            expect(getByTestId("theme")).toHaveTextContent("light");
        });

        it("should use custom storage key", () => {
            localStorageMock.getItem.mockReturnValue("system");

            const TestComponent = () => {
                const { theme } = useTheme();
                return <div data-testid="theme">{theme}</div>;
            };

            render(
                <ThemeProvider storageKey="custom-theme-key">
                    <TestComponent />
                </ThemeProvider>,
            );

            expect(localStorageMock.getItem).toHaveBeenCalledWith("custom-theme-key");
        });

        it("should fallback to system when no localStorage or defaultTheme", () => {
            localStorageMock.getItem.mockReturnValue(null);

            const TestComponent = () => {
                const { theme } = useTheme();
                return <div data-testid="theme">{theme || "undefined"}</div>;
            };

            const { getByTestId } = render(
                <ThemeProvider>
                    <TestComponent />
                </ThemeProvider>,
            );

            expect(getByTestId("theme")).toHaveTextContent("system");
        });
    });

    describe("DOM manipulation", () => {
        it("should apply light theme to documentElement", () => {
            localStorageMock.getItem.mockReturnValue("light");

            render(
                <ThemeProvider>
                    <div>test</div>
                </ThemeProvider>,
            );

            expect(document.documentElement.classList.remove).toHaveBeenCalledWith("light", "dark");
            expect(document.documentElement.classList.add).toHaveBeenCalledWith("light");
        });

        it("should apply dark theme to documentElement", () => {
            localStorageMock.getItem.mockReturnValue("dark");

            render(
                <ThemeProvider>
                    <div>test</div>
                </ThemeProvider>,
            );

            expect(document.documentElement.classList.remove).toHaveBeenCalledWith("light", "dark");
            expect(document.documentElement.classList.add).toHaveBeenCalledWith("dark");
        });

        it("should apply system theme based on media query - dark", () => {
            localStorageMock.getItem.mockReturnValue("system");
            matchMediaMock.mockReturnValue({ matches: true });

            render(
                <ThemeProvider>
                    <div>test</div>
                </ThemeProvider>,
            );

            expect(window.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
            expect(document.documentElement.classList.add).toHaveBeenCalledWith("dark");
        });

        it("should apply system theme based on media query - light", () => {
            localStorageMock.getItem.mockReturnValue("system");
            matchMediaMock.mockReturnValue({ matches: false });

            render(
                <ThemeProvider>
                    <div>test</div>
                </ThemeProvider>,
            );

            expect(window.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
            expect(document.documentElement.classList.add).toHaveBeenCalledWith("light");
        });
    });

    describe("setTheme functionality", () => {
        it("should update theme and localStorage", () => {
            localStorageMock.getItem.mockReturnValue("light");

            const wrapper = ({ children }: { children: ReactNode }) => (
                <ThemeProvider storageKey="test-key">{children}</ThemeProvider>
            );

            const { result } = renderHook(() => useTheme(), { wrapper });

            act(() => {
                result.current.setTheme("dark");
            });

            expect(localStorageMock.setItem).toHaveBeenCalledWith("test-key", "dark");
            expect(result.current.theme).toBe("dark");
        });

        it("should update DOM classes when setting theme", () => {
            localStorageMock.getItem.mockReturnValue("light");

            const wrapper = ({ children }: { children: ReactNode }) => (
                <ThemeProvider>{children}</ThemeProvider>
            );

            const { result } = renderHook(() => useTheme(), { wrapper });

            act(() => {
                result.current.setTheme("dark");
            });
            expect(document.body.classList.remove).toHaveBeenCalledWith("waldiez-dark", "waldiez-light");
            // expect(document.body.classList.toggle).toHaveBeenCalledWith("waldiez-dark", true);
            // expect(document.body.classList.toggle).toHaveBeenCalledWith("waldiez-light", false);
            // expect(document.documentElement.classList.toggle).toHaveBeenCalledWith("dark", true);
            // expect(document.documentElement.classList.toggle).toHaveBeenCalledWith("light", false);
        });

        it("should handle system theme setting", () => {
            localStorageMock.getItem.mockReturnValue("light");

            const wrapper = ({ children }: { children: ReactNode }) => (
                <ThemeProvider>{children}</ThemeProvider>
            );

            const { result } = renderHook(() => useTheme(), { wrapper });

            act(() => {
                result.current.setTheme("system");
            });

            expect(localStorageMock.setItem).toHaveBeenCalledWith("waldiez-theme", "system");
            expect(result.current.theme).toBe("system");
        });
    });

    describe("toggle functionality", () => {
        it("should toggle from light to dark", () => {
            localStorageMock.getItem.mockReturnValue("light");

            const wrapper = ({ children }: { children: ReactNode }) => (
                <ThemeProvider>{children}</ThemeProvider>
            );

            const { result } = renderHook(() => useTheme(), { wrapper });

            expect(result.current.theme).toBe("light");

            act(() => {
                result.current.toggle();
            });

            expect(result.current.theme).toBe("dark");
            expect(localStorageMock.setItem).toHaveBeenCalledWith("waldiez-theme", "dark");
        });

        it("should toggle from dark to light", () => {
            localStorageMock.getItem.mockReturnValue("dark");

            const wrapper = ({ children }: { children: ReactNode }) => (
                <ThemeProvider>{children}</ThemeProvider>
            );

            const { result } = renderHook(() => useTheme(), { wrapper });

            expect(result.current.theme).toBe("dark");

            act(() => {
                result.current.toggle();
            });

            expect(result.current.theme).toBe("light");
            expect(localStorageMock.setItem).toHaveBeenCalledWith("waldiez-theme", "light");
        });

        it("should toggle from system to light", () => {
            localStorageMock.getItem.mockReturnValue("system");

            const wrapper = ({ children }: { children: ReactNode }) => (
                <ThemeProvider>{children}</ThemeProvider>
            );

            const { result } = renderHook(() => useTheme(), { wrapper });

            expect(result.current.theme).toBe("system");

            act(() => {
                result.current.toggle();
            });

            expect(result.current.theme).toBe("light");
        });
    });

    describe("theme persistence", () => {
        it("should persist theme changes across re-renders", () => {
            localStorageMock.getItem.mockReturnValue("light");

            const wrapper = ({ children }: { children: ReactNode }) => (
                <ThemeProvider>{children}</ThemeProvider>
            );

            const { result, rerender } = renderHook(() => useTheme(), { wrapper });

            act(() => {
                result.current.setTheme("dark");
            });

            expect(result.current.theme).toBe("dark");

            rerender();

            expect(result.current.theme).toBe("dark");
        });

        it("should handle multiple rapid theme changes", () => {
            localStorageMock.getItem.mockReturnValue("light");

            const wrapper = ({ children }: { children: ReactNode }) => (
                <ThemeProvider>{children}</ThemeProvider>
            );

            const { result } = renderHook(() => useTheme(), { wrapper });

            act(() => {
                result.current.setTheme("dark");
                result.current.setTheme("system");
                result.current.setTheme("light");
            });

            expect(result.current.theme).toBe("light");
            expect(localStorageMock.setItem).toHaveBeenLastCalledWith("waldiez-theme", "light");
        });
    });

    describe("useCallback optimization", () => {
        it("should maintain stable function references", () => {
            localStorageMock.getItem.mockReturnValue("light");

            const wrapper = ({ children }: { children: ReactNode }) => (
                <ThemeProvider>{children}</ThemeProvider>
            );

            const { result, rerender } = renderHook(() => useTheme(), { wrapper });

            const firstSetTheme = result.current.setTheme;
            const firstToggle = result.current.toggle;

            rerender();

            // Functions should maintain reference equality for performance
            expect(result.current.setTheme).toBe(firstSetTheme);
            expect(result.current.toggle).toBe(firstToggle);
        });

        it("should update toggle function when theme changes", () => {
            localStorageMock.getItem.mockReturnValue("light");

            const wrapper = ({ children }: { children: ReactNode }) => (
                <ThemeProvider>{children}</ThemeProvider>
            );

            const { result } = renderHook(() => useTheme(), { wrapper });

            const firstToggle = result.current.toggle;

            act(() => {
                result.current.setTheme("dark");
            });

            // Toggle function should update because it depends on current theme
            expect(result.current.toggle).not.toBe(firstToggle);
        });
    });

    describe("error handling", () => {
        it("should handle localStorage errors gracefully", () => {
            localStorageMock.getItem.mockImplementation(() => {
                throw new Error("localStorage not available");
            });

            expect(() => {
                render(
                    <ThemeProvider defaultTheme="light">
                        <div>test</div>
                    </ThemeProvider>,
                );
            }).not.toThrow();
        });

        it("should handle setItem errors gracefully", () => {
            localStorageMock.getItem.mockReturnValue("light");
            localStorageMock.setItem.mockImplementation(() => {
                throw new Error("localStorage quota exceeded");
            });

            const wrapper = ({ children }: { children: ReactNode }) => (
                <ThemeProvider>{children}</ThemeProvider>
            );

            const { result } = renderHook(() => useTheme(), { wrapper });

            expect(() => {
                act(() => {
                    result.current.setTheme("dark");
                });
            }).not.toThrow();

            // Theme should still update in state even if localStorage fails
            expect(result.current.theme).toBe("dark");
        });
    });
});
