/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import WaldiezViewer from "@/features/viewers/components/WaldiezViewer";
import { useWaldiezSession } from "@/features/waldiez/useWaldiezSession";
import { onRunRequested, onRunStopRequested } from "@/lib/events";
import { useWorkspace } from "@/store/workspace";
import { extOf } from "@/utils/paths";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock external dependencies
vi.mock("@waldiez/react", () => ({
    default: ({ onRun, onStepRun, onConvert, onSave, chat, stepByStep }: any) => (
        <div data-testid="waldiez-component">
            <button onClick={onRun} data-testid="run-button">
                Run
            </button>
            <button onClick={onStepRun} data-testid="step-run-button">
                Step Run
            </button>
            <button onClick={onConvert} data-testid="convert-button">
                Convert
            </button>
            <button onClick={onSave} data-testid="save-button">
                Save
            </button>
            <div data-testid="chat-show">{chat?.show?.toString()}</div>
            <div data-testid="step-show">{stepByStep?.show?.toString()}</div>
        </div>
    ),
    importFlow: vi.fn().mockReturnValue({
        id: "test-flow",
        name: "Test Flow",
        agents: [],
        skills: [],
        models: [],
        chats: [],
    }),
}));

vi.mock("@/features/waldiez/useWaldiezSession", () => ({
    useWaldiezSession: vi.fn(),
}));

vi.mock("@/store/workspace", () => ({
    useWorkspace: vi.fn(selector => {
        const mockState = {
            openTabs: [],
            activeTabId: null,
            getActiveTab: () => ({
                id: "tab-1",
                item: { path: "/test/flow.waldiez", type: "file", name: "flow.waldiez" },
            }),
        };
        return selector ? selector(mockState) : mockState;
    }),
}));

vi.mock("@/lib/events", () => ({
    onRunRequested: vi.fn().mockReturnValue(() => {}),
    onRunStopRequested: vi.fn().mockReturnValue(() => {}),
}));

vi.mock("@/utils/paths", () => ({
    extOf: vi.fn(),
}));

describe("WaldiezViewer", () => {
    const mockActions = {
        run: vi.fn(),
        stepRun: vi.fn(),
        convert: vi.fn(),
        save: vi.fn(),
    };

    const mockState = {
        chat: {
            show: false,
            active: false,
            messages: [],
            userParticipants: [],
            handlers: {
                close: vi.fn(),
                send: vi.fn(),
                respond: vi.fn(),
            },
        },
        stepByStep: {
            show: false,
            active: false,
            stepMode: true,
            autoContinue: false,
            breakpoints: [],
            eventHistory: [],
            participants: [],
            handlers: {
                close: vi.fn(),
                sendControl: vi.fn(),
                respond: vi.fn(),
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();

        (useWaldiezSession as any).mockReturnValue({
            state: mockState,
            actions: mockActions,
        });

        (useWorkspace as any).mockImplementation((selector: any) => {
            const mockState = {
                openTabs: [
                    {
                        id: "tab-1",
                        item: { path: "/test/flow.waldiez", type: "file", name: "flow.waldiez" },
                    },
                ],
                activeTabId: "tab-1",
                getActiveTab: () => ({
                    id: "tab-1",
                    item: { path: "/test/flow.waldiez", type: "file", name: "flow.waldiez" },
                }),
            };
            return selector ? selector(mockState) : mockState;
        });

        (extOf as any).mockReturnValue(".waldiez");
    });

    it("renders Waldiez component", () => {
        render(<WaldiezViewer source="test flow content" />);

        expect(screen.getByTestId("waldiez-component")).toBeInTheDocument();
    });

    it("passes flow props to Waldiez component", () => {
        render(<WaldiezViewer source="test flow content" />);

        expect(screen.getByTestId("run-button")).toBeInTheDocument();
        expect(screen.getByTestId("step-run-button")).toBeInTheDocument();
        expect(screen.getByTestId("convert-button")).toBeInTheDocument();
        expect(screen.getByTestId("save-button")).toBeInTheDocument();
    });

    it("applies correct container styling", () => {
        const { container } = render(<WaldiezViewer source="test flow content" />);

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveClass("relative", "flex-1", "w-full", "h-full");
    });

    it("passes chat state to Waldiez component", () => {
        render(<WaldiezViewer source="test flow content" />);

        expect(screen.getByTestId("chat-show")).toHaveTextContent("false");
    });

    it("passes stepByStep state to Waldiez component", () => {
        render(<WaldiezViewer source="test flow content" />);

        expect(screen.getByTestId("step-show")).toHaveTextContent("false");
    });

    it("shows chat when state indicates", () => {
        (useWaldiezSession as any).mockReturnValue({
            state: {
                ...mockState,
                chat: {
                    ...mockState.chat,
                    show: true,
                },
            },
            actions: mockActions,
        });

        render(<WaldiezViewer source="test flow content" />);

        expect(screen.getByTestId("chat-show")).toHaveTextContent("true");
    });

    it("shows stepByStep when handlers exist and state shows", () => {
        (useWaldiezSession as any).mockReturnValue({
            state: {
                ...mockState,
                stepByStep: {
                    ...mockState.stepByStep,
                    show: true,
                },
            },
            actions: mockActions,
        });

        render(<WaldiezViewer source="test flow content" />);

        expect(screen.getByTestId("step-show")).toHaveTextContent("true");
    });

    it("hides stepByStep when no handlers", () => {
        (useWaldiezSession as any).mockReturnValue({
            state: {
                ...mockState,
                stepByStep: {
                    ...mockState.stepByStep,
                    show: true,
                    handlers: null,
                },
            },
            actions: mockActions,
        });

        render(<WaldiezViewer source="test flow content" />);

        expect(screen.getByTestId("step-show")).toHaveTextContent("false");
    });

    it("sets up event listeners for run requests", () => {
        render(<WaldiezViewer source="test flow content" />);

        expect(onRunRequested).toHaveBeenCalledWith(expect.any(Function));
        expect(onRunStopRequested).toHaveBeenCalledWith(expect.any(Function));
    });

    it("handles run event for current path", () => {
        const mockOnRunRequested = onRunRequested as any;
        let runHandler: (detail: any) => void;

        mockOnRunRequested.mockImplementation((handler: any) => {
            runHandler = handler;
            return () => {};
        });

        render(<WaldiezViewer source="test flow content" />);

        // Trigger run event
        runHandler!({ path: "/test/flow.waldiez", mode: "chat" });

        expect(mockActions.run).toHaveBeenCalled();
    });

    it("handles step run event for current path", () => {
        const mockOnRunRequested = onRunRequested as any;
        let runHandler: (detail: any) => void;

        mockOnRunRequested.mockImplementation((handler: any) => {
            runHandler = handler;
            return () => {};
        });

        render(<WaldiezViewer source="test flow content" />);

        // Trigger step run event
        runHandler!({ path: "/test/flow.waldiez", mode: "step" });

        expect(mockActions.stepRun).toHaveBeenCalled();
    });

    it("ignores run events for different paths", () => {
        const mockOnRunRequested = onRunRequested as any;
        let runHandler: (detail: any) => void;

        mockOnRunRequested.mockImplementation((handler: any) => {
            runHandler = handler;
            return () => {};
        });

        render(<WaldiezViewer source="test flow content" />);

        // Trigger run event for different path
        runHandler!({ path: "/other/flow.waldiez", mode: "chat" });

        expect(mockActions.run).not.toHaveBeenCalled();
        expect(mockActions.stepRun).not.toHaveBeenCalled();
    });

    it("handles missing path in workspace", () => {
        (useWorkspace as any).mockImplementation((selector: any) => {
            const mockState = {
                openTabs: [],
                activeTabId: null,
                getActiveTab: () => undefined,
            };
            return selector ? selector(mockState) : mockState;
        });

        render(<WaldiezViewer source="test flow content" />);

        // Should render without errors
        expect(screen.getByTestId("waldiez-component")).toBeInTheDocument();
    });

    it("provides default values for missing chat properties", () => {
        (useWaldiezSession as any).mockReturnValue({
            state: {
                chat: {},
                stepByStep: {},
            },
            actions: mockActions,
        });

        render(<WaldiezViewer source="test flow content" />);

        expect(screen.getByTestId("chat-show")).toHaveTextContent("false");
        expect(screen.getByTestId("step-show")).toHaveTextContent("false");
    });

    it("cleans up event listeners on unmount", () => {
        const mockOffRun = vi.fn();
        const mockOffStop = vi.fn();

        (onRunRequested as any).mockReturnValue(mockOffRun);
        (onRunStopRequested as any).mockReturnValue(mockOffStop);

        const { unmount } = render(<WaldiezViewer source="test flow content" />);

        unmount();

        expect(mockOffRun).toHaveBeenCalled();
        expect(mockOffStop).toHaveBeenCalled();
    });

    it("handles source updates", () => {
        const { rerender } = render(<WaldiezViewer source="initial content" />);

        rerender(<WaldiezViewer source="updated content" />);

        expect(screen.getByTestId("waldiez-component")).toBeInTheDocument();
    });
});
