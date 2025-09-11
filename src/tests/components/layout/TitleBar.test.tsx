/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import TitleBar from "@/components/layout/TitleBar";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/components/ui/button", () => ({
    Button: ({ children, onClick, variant, ...props }: any) => (
        <button onClick={onClick} data-variant={variant} {...props}>
            {children}
        </button>
    ),
}));

vi.mock("@/theme/toggle", () => ({
    ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));

vi.mock("lucide-react", () => ({
    PanelBottom: () => <div data-testid="panel-bottom-icon" />,
    PanelsTopLeft: () => <div data-testid="panels-top-left-icon" />,
    Play: () => <div data-testid="play-icon" />,
    Square: () => <div data-testid="square-icon" />,
}));

describe("TitleBar", () => {
    const defaultProps = {
        running: false,
        startedAt: null,
        runnable: false,
        onRun: vi.fn(),
        onStop: vi.fn(),
        onToggleSidebar: vi.fn(),
        onToggleDock: vi.fn(),
        currentPath: null,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders basic title bar structure", () => {
        render(<TitleBar {...defaultProps} />);

        expect(screen.getByText("Waldiez Studio")).toBeInTheDocument();
        expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
        expect(screen.getByTestId("panels-top-left-icon")).toBeInTheDocument();
        expect(screen.getByTestId("panel-bottom-icon")).toBeInTheDocument();
    });

    it("displays current path", () => {
        render(<TitleBar {...defaultProps} currentPath="/test/file.py" />);

        expect(screen.getByText("/test/file.py")).toBeInTheDocument();
    });

    it("displays default path when none provided", () => {
        render(<TitleBar {...defaultProps} />);

        expect(screen.getByText("/")).toBeInTheDocument();
    });

    it("calls onToggleSidebar when sidebar button is clicked", () => {
        const onToggleSidebar = vi.fn();
        render(<TitleBar {...defaultProps} onToggleSidebar={onToggleSidebar} />);

        const sidebarButton = screen.getByTestId("panels-top-left-icon").closest("button");
        fireEvent.click(sidebarButton!);

        expect(onToggleSidebar).toHaveBeenCalled();
    });

    it("calls onToggleDock when dock button is clicked", () => {
        const onToggleDock = vi.fn();
        render(<TitleBar {...defaultProps} onToggleDock={onToggleDock} />);

        const dockButton = screen.getByTestId("panel-bottom-icon").closest("button");
        fireEvent.click(dockButton!);

        expect(onToggleDock).toHaveBeenCalled();
    });

    it("shows run button when runnable and not running", () => {
        render(<TitleBar {...defaultProps} runnable={true} />);

        expect(screen.getByText("Run")).toBeInTheDocument();
        expect(screen.getByTestId("play-icon")).toBeInTheDocument();
    });

    it("calls onRun when run button is clicked", () => {
        const onRun = vi.fn();
        render(<TitleBar {...defaultProps} runnable={true} onRun={onRun} />);

        fireEvent.click(screen.getByText("Run"));

        expect(onRun).toHaveBeenCalled();
    });

    it("hides run button when not runnable", () => {
        render(<TitleBar {...defaultProps} runnable={false} />);

        expect(screen.queryByText("Run")).not.toBeInTheDocument();
    });

    it("shows stop button and running indicator when running", () => {
        render(<TitleBar {...defaultProps} running={true} startedAt={Date.now()} />);

        expect(screen.getByText("Stop")).toBeInTheDocument();
        expect(screen.getByTestId("square-icon")).toBeInTheDocument();
        expect(screen.getByText(/Running/)).toBeInTheDocument();
    });

    it("calls onStop when stop button is clicked", () => {
        const onStop = vi.fn();
        render(<TitleBar {...defaultProps} running={true} onStop={onStop} />);

        fireEvent.click(screen.getByText("Stop"));

        expect(onStop).toHaveBeenCalled();
    });

    it("displays elapsed time when running", async () => {
        const startTime = Date.now();
        vi.setSystemTime(startTime);

        render(<TitleBar {...defaultProps} running={true} startedAt={startTime} />);

        // Initially shows Running...
        expect(screen.getByText(/Running.../)).toBeInTheDocument();

        // Advance time by 65 seconds
        act(() => {
            vi.advanceTimersByTime(65000);
        });

        await waitFor(() => {
            expect(screen.getByText(/Running · 1:05/)).toBeInTheDocument();
        });
    });

    it("displays elapsed time with hours when over 1 hour", async () => {
        const startTime = Date.now();
        vi.setSystemTime(startTime);

        render(<TitleBar {...defaultProps} running={true} startedAt={startTime} />);

        // Advance time by 3665 seconds (1 hour, 1 minute, 5 seconds)
        act(() => {
            vi.advanceTimersByTime(3665000);
        });

        await waitFor(() => {
            expect(screen.getByText(/Running · 1:01:05/)).toBeInTheDocument();
        });
    });

    it("does not show elapsed time when not running", () => {
        render(<TitleBar {...defaultProps} running={false} startedAt={Date.now()} />);

        expect(screen.queryByText(/Running/)).not.toBeInTheDocument();
    });

    it("handles missing callbacks gracefully", () => {
        const propsWithoutCallbacks = {
            running: false,
            startedAt: null,
            runnable: true,
            currentPath: null,
        };

        expect(() => {
            render(<TitleBar {...propsWithoutCallbacks} />);
        }).not.toThrow();

        // Should be able to click buttons without errors
        const buttons = screen.getAllByRole("button");
        buttons.forEach(button => {
            expect(() => fireEvent.click(button)).not.toThrow();
        });
    });

    it("applies correct button variants", () => {
        render(<TitleBar {...defaultProps} running={true} runnable={true} />);

        const stopButton = screen.getByText("Stop").closest("button");
        expect(stopButton).toHaveAttribute("data-variant", "destructive");

        // Re-render with run button
        render(<TitleBar {...defaultProps} running={false} runnable={true} />);

        const runButton = screen.getByText("Run").closest("button");
        expect(runButton).toHaveAttribute("data-variant", "default");
    });

    it("truncates long paths", () => {
        const longPath = "/very/very/very/very/very/very/long/path/to/some/deeply/nested/file.py";

        const { container } = render(<TitleBar {...defaultProps} currentPath={longPath} />);

        const pathElement = container.querySelector(".truncate");
        expect(pathElement).toBeInTheDocument();
        expect(pathElement).toHaveClass("max-w-[40vw]");
    });

    it("shows pulsing animation when running", () => {
        render(<TitleBar {...defaultProps} running={true} startedAt={Date.now()} />);

        const pulsingElement = document.querySelector(".animate-ping");
        expect(pulsingElement).toBeInTheDocument();
    });

    it("updates timer every second when running", () => {
        const startTime = Date.now();
        vi.setSystemTime(startTime);

        render(<TitleBar {...defaultProps} running={true} startedAt={startTime} />);

        act(() => {
            vi.advanceTimersByTime(1000);
        });

        // Timer should update
        expect(vi.getTimerCount()).toBeGreaterThan(0);
    });

    it("clears timer when component unmounts", () => {
        const startTime = Date.now();

        const { unmount } = render(<TitleBar {...defaultProps} running={true} startedAt={startTime} />);

        unmount();

        // Should not have active timers after unmount
        expect(vi.getTimerCount()).toBe(0);
    });
});
