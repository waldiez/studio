/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import Layout from "@/app/Layout";
import { emitRunRequested, emitRunStopRequested } from "@/lib/events";
import { useExec } from "@/store/exec";
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

vi.mock("@/lib/events", () => ({
    emitRunRequested: vi.fn(),
    emitRunStopRequested: vi.fn(),
}));

vi.mock("@/store/exec", () => ({
    useExec: vi.fn(),
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

vi.mock("react-resizable-panels", () => ({
    Group: ({ children, id, className }: any) => (
        <div data-testid={`group-${id}`} className={className}>
            {children}
        </div>
    ),
    Panel: ({ children, id, className }: any) => (
        <div data-testid={`panel-${id}`} className={className}>
            {children}
        </div>
    ),
    Separator: ({ children, className }: any) => (
        <div data-testid="separator" className={className}>
            {children}
        </div>
    ),
    useDefaultLayout: () => ({
        defaultLayout: undefined,
        onLayoutChange: vi.fn(),
    }),
    usePanelRef: () => ({ current: null }),
}));

describe("Layout", () => {
    const mockEmitRunRequested = emitRunRequested as ReturnType<typeof vi.fn>;
    const mockEmitRunStopRequested = emitRunStopRequested as ReturnType<typeof vi.fn>;
    const defaultProps = {
        left: <div data-testid="left-content">Left Panel</div>,
        main: <div data-testid="main-content">Main Content</div>,
        bottom: <div data-testid="bottom-content">Bottom Panel</div>,
    };
    beforeEach(() => {
        vi.clearAllMocks();

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
    it("renders all three panel sections", () => {
        render(<Layout {...defaultProps} />);

        expect(screen.getByTestId("left-content")).toBeInTheDocument();
        expect(screen.getByTestId("main-content")).toBeInTheDocument();
        expect(screen.getByTestId("bottom-content")).toBeInTheDocument();
    });

    it("renders title bar", () => {
        render(<Layout {...defaultProps} />);

        expect(screen.getByTestId("title-bar")).toBeInTheDocument();
    });

    it("renders panel structure with correct ids", () => {
        render(<Layout {...defaultProps} />);

        expect(screen.getByTestId("group-root-panel")).toBeInTheDocument();
        expect(screen.getByTestId("group-right-panel")).toBeInTheDocument();
        expect(screen.getByTestId("panel-left")).toBeInTheDocument();
        expect(screen.getByTestId("panel-right")).toBeInTheDocument();
        expect(screen.getByTestId("panel-top")).toBeInTheDocument();
        expect(screen.getByTestId("panel-bottom")).toBeInTheDocument();
    });

    it("renders separators between panels", () => {
        render(<Layout {...defaultProps} />);

        const separators = screen.getAllByTestId("separator");
        expect(separators).toHaveLength(2);
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
});
