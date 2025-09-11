/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { ThemeToggle } from "@/theme/toggle";
import { fireEvent, render, screen } from "@testing-library/react";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the theme hook
const mockUseTheme = {
    theme: "light" as "light" | "dark" | "system",
    toggle: vi.fn(),
    setTheme: vi.fn(),
};

vi.mock("@/theme/hook", () => ({
    useTheme: () => mockUseTheme,
}));

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("ThemeToggle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.getItem.mockReturnValue("light");

        // Reset DOM mocks
        document.documentElement.classList.remove = vi.fn();
        document.documentElement.classList.add = vi.fn();
        document.documentElement.classList.toggle = vi.fn();
        document.body.classList.toggle = vi.fn();
    });

    it("should render moon icon when theme is light", () => {
        mockUseTheme.theme = "light";

        render(<ThemeToggle />);

        // Moon icon should be present for light theme
        const moonIcon = document.querySelector(".lucide-moon");
        expect(moonIcon).toBeInTheDocument();

        // Sun icon should not be present
        const sunIcon = document.querySelector(".lucide-sun");
        expect(sunIcon).not.toBeInTheDocument();
    });

    it("should render sun icon when theme is dark", () => {
        mockUseTheme.theme = "dark";

        render(<ThemeToggle />);

        // Sun icon should be present for dark theme
        const sunIcon = document.querySelector(".lucide-sun");
        expect(sunIcon).toBeInTheDocument();

        // Moon icon should not be present
        const moonIcon = document.querySelector(".lucide-moon");
        expect(moonIcon).not.toBeInTheDocument();
    });

    it("should render moon icon when theme is system", () => {
        mockUseTheme.theme = "system";

        render(<ThemeToggle />);

        // Moon icon should be present for system theme (default behavior)
        const moonIcon = document.querySelector(".lucide-moon");
        expect(moonIcon).toBeInTheDocument();
    });

    it("should call toggle function when button is clicked", () => {
        mockUseTheme.theme = "light";
        const toggleSpy = mockUseTheme.toggle as Mock;

        render(<ThemeToggle />);

        const button = screen.getByRole("button");
        fireEvent.click(button);

        expect(toggleSpy).toHaveBeenCalledTimes(1);
    });

    it("should have correct button classes", () => {
        mockUseTheme.theme = "light";

        render(<ThemeToggle />);

        const button = screen.getByRole("button");
        expect(button).toHaveClass("px-3", "py-1.5", "no-border", "clickable", "rounded", "text-sm");
    });

    it("should have correct icon dimensions", () => {
        mockUseTheme.theme = "light";

        render(<ThemeToggle />);

        const moonIcon = document.querySelector(".lucide-moon");
        expect(moonIcon).toHaveClass("h-[1.2rem]", "w-[1.2rem]");
    });

    it("should handle multiple clicks", () => {
        mockUseTheme.theme = "light";
        const toggleSpy = mockUseTheme.toggle as Mock;

        render(<ThemeToggle />);

        const button = screen.getByRole("button");

        fireEvent.click(button);
        fireEvent.click(button);
        fireEvent.click(button);

        expect(toggleSpy).toHaveBeenCalledTimes(3);
    });

    describe("theme transitions", () => {
        it("should update icon when theme changes from light to dark", () => {
            mockUseTheme.theme = "light";

            const { rerender } = render(<ThemeToggle />);

            // Initially shows moon icon
            expect(document.querySelector(".lucide-moon")).toBeInTheDocument();
            expect(document.querySelector(".lucide-sun")).not.toBeInTheDocument();

            // Change theme to dark
            mockUseTheme.theme = "dark";
            rerender(<ThemeToggle />);

            // Now shows sun icon
            expect(document.querySelector(".lucide-sun")).toBeInTheDocument();
            expect(document.querySelector(".lucide-moon")).not.toBeInTheDocument();
        });

        it("should update icon when theme changes from dark to light", () => {
            mockUseTheme.theme = "dark";

            const { rerender } = render(<ThemeToggle />);

            // Initially shows sun icon
            expect(document.querySelector(".lucide-sun")).toBeInTheDocument();
            expect(document.querySelector(".lucide-moon")).not.toBeInTheDocument();

            // Change theme to light
            mockUseTheme.theme = "light";
            rerender(<ThemeToggle />);

            // Now shows moon icon
            expect(document.querySelector(".lucide-moon")).toBeInTheDocument();
            expect(document.querySelector(".lucide-sun")).not.toBeInTheDocument();
        });

        it("should handle system theme appropriately", () => {
            mockUseTheme.theme = "system";

            render(<ThemeToggle />);

            // System theme should show moon icon (non-dark state)
            expect(document.querySelector(".lucide-moon")).toBeInTheDocument();
            expect(document.querySelector(".lucide-sun")).not.toBeInTheDocument();
        });
    });

    describe("icon svg content", () => {
        it("should render correct SVG for moon icon", () => {
            mockUseTheme.theme = "light";

            render(<ThemeToggle />);

            const svg = document.querySelector("svg.lucide-moon");
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");
            expect(svg).toHaveAttribute("viewBox", "0 0 24 24");

            // Check for moon path content
            const path = svg?.querySelector("path");
            expect(path).toBeInTheDocument();
        });

        it("should render correct SVG for sun icon", () => {
            mockUseTheme.theme = "dark";

            render(<ThemeToggle />);

            const svg = document.querySelector("svg.lucide-sun");
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");
            expect(svg).toHaveAttribute("viewBox", "0 0 24 24");

            // Sun icon has both circle and line elements
            const circle = svg?.querySelector("circle");
            expect(circle).toBeInTheDocument();
        });
    });

    describe("error handling", () => {
        it("should handle missing theme gracefully", () => {
            // @ts-expect-error - Testing invalid theme
            mockUseTheme.theme = undefined;

            expect(() => render(<ThemeToggle />)).not.toThrow();

            // Should default to showing moon icon
            const moonIcon = document.querySelector(".lucide-moon");
            expect(moonIcon).toBeInTheDocument();
        });

        it("should handle invalid theme values", () => {
            // @ts-expect-error - Testing invalid theme
            mockUseTheme.theme = "invalid-theme";

            expect(() => render(<ThemeToggle />)).not.toThrow();

            // Should default to showing moon icon
            const moonIcon = document.querySelector(".lucide-moon");
            expect(moonIcon).toBeInTheDocument();
        });
    });

    describe("component structure", () => {
        it("should render a single button element", () => {
            mockUseTheme.theme = "light";

            render(<ThemeToggle />);

            const buttons = screen.getAllByRole("button");
            expect(buttons).toHaveLength(1);
        });

        it("should contain exactly one icon", () => {
            mockUseTheme.theme = "light";

            render(<ThemeToggle />);

            const icons = document.querySelectorAll("svg");
            expect(icons).toHaveLength(1);

            const button = screen.getByRole("button");
            const iconInButton = button.querySelector("svg");
            expect(iconInButton).toBeInTheDocument();
        });

        it("should have proper icon accessibility", () => {
            mockUseTheme.theme = "light";

            render(<ThemeToggle />);

            const icon = document.querySelector("svg");
            expect(icon).toHaveAttribute("aria-hidden", "true");
        });
    });
});
