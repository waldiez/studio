/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { App } from "@/app/App";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/app/Layout", () => ({
    default: ({ left, main, bottom }: any) => (
        <div data-testid="layout">
            <div data-testid="left-section">{left}</div>
            <div data-testid="main-section">{main}</div>
            <div data-testid="bottom-section">{bottom}</div>
        </div>
    ),
}));

vi.mock("@/components/layout/BottomPanel", () => ({
    default: () => <div data-testid="bottom-panel">Bottom Panel</div>,
}));

vi.mock("@/components/layout/LeftSidebar", () => ({
    default: () => <div data-testid="left-sidebar">Left Sidebar</div>,
}));

vi.mock("@/components/layout/MainView", () => ({
    default: () => <div data-testid="main-view">Main View</div>,
}));

vi.mock("@/theme/provider", () => ({
    ThemeProvider: ({ children, defaultTheme }: any) => (
        <div data-testid="theme-provider" data-default-theme={defaultTheme}>
            {children}
        </div>
    ),
}));

vi.mock("@/hooks/GlobalRunListener", () => ({
    default: () => <div data-testid="global-run-listener">Global Run Listener</div>,
}));

vi.mock("@/hooks/KeyboardListener", () => ({
    default: () => <div data-testid="keyboard-listener">Keyboard Listener</div>,
}));

describe("App", () => {
    it("renders all main components", () => {
        render(<App />);

        expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
        expect(screen.getByTestId("global-run-listener")).toBeInTheDocument();
        expect(screen.getByTestId("keyboard-listener")).toBeInTheDocument();
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(screen.getByTestId("left-sidebar")).toBeInTheDocument();
        expect(screen.getByTestId("main-view")).toBeInTheDocument();
        expect(screen.getByTestId("bottom-panel")).toBeInTheDocument();
    });

    it("sets default theme to dark", () => {
        render(<App />);

        const themeProvider = screen.getByTestId("theme-provider");
        expect(themeProvider).toHaveAttribute("data-default-theme", "dark");
    });

    it("renders components in correct layout sections", () => {
        render(<App />);

        const leftSection = screen.getByTestId("left-section");
        const mainSection = screen.getByTestId("main-section");
        const bottomSection = screen.getByTestId("bottom-section");

        expect(leftSection).toContainElement(screen.getByTestId("left-sidebar"));
        expect(mainSection).toContainElement(screen.getByTestId("main-view"));
        expect(bottomSection).toContainElement(screen.getByTestId("bottom-panel"));
    });

    it("wraps everything in ThemeProvider", () => {
        render(<App />);
        const themeProvider = screen.getByTestId("theme-provider");
        expect(themeProvider).toContainElement(screen.getByTestId("global-run-listener"));
        expect(themeProvider).toContainElement(screen.getByTestId("layout"));
    });
});
