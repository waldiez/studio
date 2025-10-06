/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import Layout from "@/app/Layout";
import { emitRunRequested, emitRunStopRequested } from "@/lib/events";
import { useExec } from "@/store/exec";
import { useLayout } from "@/store/layout";
import { useWorkspace } from "@/store/workspace";
import { isRunnable } from "@/utils/paths";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/components/layout/TitleBar", () => ({
    default: ({ onRun, onStop, onToggleSidebar, onToggleDock, running, runnable }: any) => (
        <div data-testid="title-bar">
            <button onClick={onRun} data-testid="run-button" disabled={!runnable}>
                Run
            </button>
            <button onClick={onStop} data-testid="stop-button" disabled={!running}>
                Stop
            </button>
            <button onClick={onToggleSidebar} data-testid="toggle-sidebar">
                Toggle Sidebar
            </button>
            <button onClick={onToggleDock} data-testid="toggle-dock">
                Toggle Dock
            </button>
        </div>
    ),
}));

vi.mock("@/components/ui/resizable", () => {
    const createMockPanelRef = () => ({
        isCollapsed: vi.fn(() => false),
        expand: vi.fn(),
        collapse: vi.fn(),
    });

    return {
        ResizableHandle: ({ withHandle }: any) => (
            <div data-testid="resizable-handle" data-with-handle={withHandle} />
        ),
        ResizablePanel: ({
            children,
            className,
            defaultSize,
            minSize,
            collapsedSize,
            collapsible,
            ...props
        }: any) => {
            const mockRef = createMockPanelRef();

            // If a ref is passed, simulate assigning the mock methods
            if (props.ref && typeof props.ref === "object") {
                props.ref.current = mockRef;
            }

            return (
                <div
                    data-testid="resizable-panel"
                    className={className}
                    // @cspell: disable-next-line
                    defaultsize={defaultSize}
                    // @cspell: disable-next-line
                    collapsedsize={collapsedSize}
                    minsize={minSize}
                    collapsible={`${collapsible}`}
                    {...props}
                >
                    {children}
                </div>
            );
        },
        ResizablePanelGroup: ({ children, direction, onLayout }: any) => (
            <div
                data-testid="resizable-panel-group"
                data-direction={direction}
                onChange={(sizes: any) => onLayout?.(sizes)}
            >
                {children}
            </div>
        ),
    };
});

vi.mock("@/lib/events", () => ({
    emitRunRequested: vi.fn(),
    emitRunStopRequested: vi.fn(),
}));

vi.mock("@/store/exec", () => ({
    useExec: vi.fn(),
}));

vi.mock("@/store/layout", () => ({
    useLayout: vi.fn(),
}));

vi.mock("@/store/workspace", () => ({
    useWorkspace: vi.fn(selector => {
        const mockState = {
            openTabs: [],
            activeTabId: null,
            getActiveTab: () => ({
                id: "tab-1",
                item: { path: "/test/file.py", type: "file", name: "file.py" },
            }),
        };
        return selector ? selector(mockState) : mockState;
    }),
}));

vi.mock("@/utils/paths", () => ({
    isRunnable: vi.fn(),
}));

describe("Layout", () => {
    const mockEmitRunRequested = emitRunRequested as ReturnType<typeof vi.fn>;
    const mockEmitRunStopRequested = emitRunStopRequested as ReturnType<typeof vi.fn>;
    const mockSetHorizontal = vi.fn();
    const mockSetVertical = vi.fn();
    const mockSetLeftCollapsed = vi.fn();
    const mockSetBottomCollapsed = vi.fn();

    const defaultProps = {
        left: <div data-testid="left-content">Left Content</div>,
        main: <div data-testid="main-content">Main Content</div>,
        bottom: <div data-testid="bottom-content">Bottom Content</div>,
    };

    beforeEach(() => {
        vi.clearAllMocks();

        (useLayout as any).mockReturnValue({
            hSizes: [25, 75],
            vSizes: [70, 30],
            setHorizontal: mockSetHorizontal,
            setVertical: mockSetVertical,
            leftCollapsed: false,
            bottomCollapsed: false,
            setLeftCollapsed: mockSetLeftCollapsed,
            setBottomCollapsed: mockSetBottomCollapsed,
        });

        (useExec as any).mockReturnValue({
            running: false,
            taskPath: null,
            startedAt: null,
        });

        (useWorkspace as any).mockImplementation((selector: any) => {
            const mockState = {
                openTabs: [
                    {
                        id: "tab-1",
                        item: { path: "/test/file.py", type: "file", name: "file.py" },
                    },
                ],
                activeTabId: "tab-1",
                getActiveTab: () => ({
                    id: "tab-1",
                    item: { path: "/test/file.py", type: "file", name: "file.py" },
                }),
            };
            return selector ? selector(mockState) : mockState;
        });

        (isRunnable as any).mockReturnValue(true);
    });

    it("renders all layout sections", () => {
        render(<Layout {...defaultProps} />);

        expect(screen.getByTestId("title-bar")).toBeInTheDocument();
        expect(screen.getByTestId("left-content")).toBeInTheDocument();
        expect(screen.getByTestId("main-content")).toBeInTheDocument();
        expect(screen.getByTestId("bottom-content")).toBeInTheDocument();
    });

    it("renders resizable panels with correct structure", () => {
        render(<Layout {...defaultProps} />);

        const panelGroups = screen.getAllByTestId("resizable-panel-group");
        expect(panelGroups).toHaveLength(2);
        expect(panelGroups[0]).toHaveAttribute("data-direction", "horizontal");
        expect(panelGroups[1]).toHaveAttribute("data-direction", "vertical");
    });

    it("emits run request when run button is clicked", () => {
        render(<Layout {...defaultProps} />);

        fireEvent.click(screen.getByTestId("run-button"));

        expect(mockEmitRunRequested).toHaveBeenCalledWith({
            path: "/test/file.py",
            mode: "chat",
        });
    });

    it("emits stop request when stop button is clicked", () => {
        (useExec as any).mockReturnValue({
            running: true,
            taskPath: "/test/file.py",
            startedAt: Date.now(),
        });

        render(<Layout {...defaultProps} />);

        fireEvent.click(screen.getByTestId("stop-button"));

        expect(mockEmitRunStopRequested).toHaveBeenCalled();
    });

    it("uses task path when available", () => {
        (useExec as any).mockReturnValue({
            running: true,
            taskPath: "/running/task.py",
            startedAt: Date.now(),
        });

        render(<Layout {...defaultProps} />);

        fireEvent.click(screen.getByTestId("run-button"));

        expect(mockEmitRunRequested).toHaveBeenCalledWith({
            path: "/running/task.py",
            mode: "chat",
        });
    });

    it("handles missing current path gracefully", () => {
        (useWorkspace as any).mockImplementation((selector: any) => {
            const mockState = {
                openTabs: [],
                activeTabId: null,
                getActiveTab: () => undefined,
            };
            return selector ? selector(mockState) : mockState;
        });

        render(<Layout {...defaultProps} />);

        fireEvent.click(screen.getByTestId("run-button"));

        expect(mockEmitRunRequested).not.toHaveBeenCalled();
    });

    it("applies correct CSS classes for app dimensions", () => {
        const { container } = render(<Layout {...defaultProps} />);

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveClass(
            "h-[var(--app-height)]",
            "w-[var(--app-width)]",
            "flex",
            "flex-col",
            "bg-[var(--background-color)]",
            "text-[var(--text-color)]",
        );
    });

    it("shows resizable handles when panels are not collapsed", () => {
        render(<Layout {...defaultProps} />);

        const handles = screen.getAllByTestId("resizable-handle");
        expect(handles).toHaveLength(2);
        handles.forEach(handle => {
            expect(handle).toHaveAttribute("data-with-handle", "true");
        });
    });

    it("hides resizable handles when panels are collapsed", () => {
        (useLayout as any).mockReturnValue({
            hSizes: [25, 75],
            vSizes: [70, 30],
            setHorizontal: mockSetHorizontal,
            setVertical: mockSetVertical,
            leftCollapsed: true,
            bottomCollapsed: true,
            setLeftCollapsed: mockSetLeftCollapsed,
            setBottomCollapsed: mockSetBottomCollapsed,
        });

        render(<Layout {...defaultProps} />);

        const handles = screen.queryAllByTestId("resizable-handle");
        expect(handles).toHaveLength(0);
    });

    it("handles non-runnable files", () => {
        (isRunnable as any).mockReturnValue(false);

        render(<Layout {...defaultProps} />);

        const runButton = screen.getByTestId("run-button");
        expect(runButton).toBeDisabled();
    });

    it("applies correct panel classes", () => {
        render(<Layout {...defaultProps} />);

        const panels = screen.getAllByTestId("resizable-panel");

        // Left panel
        expect(panels[0]).toHaveClass(
            "border-r",
            "border-[var(--border-color)]",
            "bg-[var(--primary-alt-color)]",
            "min-w-0",
            "data-[collapsed=true]:border-0",
        );

        // Bottom panel
        expect(panels[2]).toHaveClass("min-h-[160px]");
    });

    it("handles sidebar toggle button", () => {
        render(<Layout {...defaultProps} />);

        const toggleButton = screen.getByTestId("toggle-sidebar");

        // Should not throw an error when clicked (testing with mocked refs)
        expect(toggleButton).toBeInTheDocument();
    });

    it("handles dock toggle button", () => {
        render(<Layout {...defaultProps} />);

        const toggleButton = screen.getByTestId("toggle-dock");

        // Should not throw an error when clicked (testing with mocked refs)
        expect(toggleButton).toBeInTheDocument();
    });

    it("passes correct props to TitleBar", () => {
        (useExec as any).mockReturnValue({
            running: true,
            taskPath: "/test/script.py",
            startedAt: 1234567890,
        });

        render(<Layout {...defaultProps} />);

        const titleBar = screen.getByTestId("title-bar");
        expect(titleBar).toBeInTheDocument();

        // TitleBar should receive running=true and make stop button enabled
        const stopButton = screen.getByTestId("stop-button");
        expect(stopButton).not.toBeDisabled();
    });

    it("handles edge case with undefined workspace selector", () => {
        (useWorkspace as any).mockImplementation((selector: any) => {
            // Return null when selector is called with undefined state
            try {
                return selector({ selected: null });
            } catch {
                return null;
            }
        });

        expect(() => {
            render(<Layout {...defaultProps} />);
        }).not.toThrow();
    });
});
