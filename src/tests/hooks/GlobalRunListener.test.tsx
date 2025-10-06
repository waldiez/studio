/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import GlobalRunListener from "@/hooks/GlobalRunListener";
import { onRunRequested, onRunStopRequested } from "@/lib/events";
import { extOf, isRunnable, isWaldiez } from "@/utils/paths";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock dependencies
const mockRun = vi.fn();
const mockStop = vi.fn();

vi.mock("@/lib/events", () => ({
    onRunRequested: vi.fn(),
    onRunStopRequested: vi.fn(),
}));

vi.mock("@/store/exec", () => ({
    useExec: {
        getState: () => ({
            run: mockRun,
            stop: mockStop,
        }),
    },
}));

vi.mock("@/utils/paths", () => ({
    extOf: vi.fn(),
    isRunnable: vi.fn(),
    isWaldiez: vi.fn(),
}));

describe("GlobalRunListener", () => {
    const mockOnRunRequested = onRunRequested as ReturnType<typeof vi.fn>;
    const mockOnRunStopRequested = onRunStopRequested as ReturnType<typeof vi.fn>;
    const mockExtOf = extOf as ReturnType<typeof vi.fn>;
    const mockIsRunnable = isRunnable as ReturnType<typeof vi.fn>;
    const mockIsWaldiez = isWaldiez as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockOnRunRequested.mockReturnValue(() => {});
        mockOnRunStopRequested.mockReturnValue(() => {});
    });

    it("renders without visual output", () => {
        const { container } = render(<GlobalRunListener />);
        expect(container.firstChild).toBeNull();
    });

    it("sets up event listeners on mount", () => {
        render(<GlobalRunListener />);

        expect(mockOnRunRequested).toHaveBeenCalledWith(expect.any(Function));
        expect(mockOnRunStopRequested).toHaveBeenCalledWith(expect.any(Function));
    });

    it("handles run requests for runnable Python files", () => {
        mockIsRunnable.mockReturnValue(true);
        mockIsWaldiez.mockReturnValue(false);
        mockExtOf.mockReturnValue(".py");

        let runRequestHandler: (detail: any) => void;
        mockOnRunRequested.mockImplementation(handler => {
            runRequestHandler = handler;
            return () => {};
        });

        render(<GlobalRunListener />);

        const runRequest = { path: "/test/script.py", mode: "chat" };
        runRequestHandler!(runRequest);

        expect(mockRun).toHaveBeenCalledWith("/test/script.py", { args: [] });
    });

    it("handles run requests for notebook files", () => {
        mockIsRunnable.mockReturnValue(true);
        mockIsWaldiez.mockReturnValue(false);
        mockExtOf.mockReturnValue(".ipynb");

        let runRequestHandler: (detail: any) => void;
        mockOnRunRequested.mockImplementation(handler => {
            runRequestHandler = handler;
            return () => {};
        });

        render(<GlobalRunListener />);

        const runRequest = { path: "/test/notebook.ipynb", mode: "chat" };
        runRequestHandler!(runRequest);

        expect(mockRun).toHaveBeenCalledWith("/test/notebook.ipynb", { args: [] });
    });

    it("ignores non-runnable files", () => {
        mockIsRunnable.mockReturnValue(false);

        let runRequestHandler: (detail: any) => void;
        mockOnRunRequested.mockImplementation(handler => {
            runRequestHandler = handler;
            return () => {};
        });

        render(<GlobalRunListener />);

        const runRequest = { path: "/test/image.png", mode: "chat" };
        runRequestHandler!(runRequest);

        expect(mockRun).not.toHaveBeenCalled();
    });

    it("ignores Waldiez files", () => {
        mockIsRunnable.mockReturnValue(true);
        mockIsWaldiez.mockReturnValue(true);

        let runRequestHandler: (detail: any) => void;
        mockOnRunRequested.mockImplementation(handler => {
            runRequestHandler = handler;
            return () => {};
        });

        render(<GlobalRunListener />);

        const runRequest = { path: "/test/flow.waldiez", mode: "chat" };
        runRequestHandler!(runRequest);

        expect(mockRun).not.toHaveBeenCalled();
    });

    it("handles stop requests", () => {
        let stopRequestHandler: () => void;
        mockOnRunStopRequested.mockImplementation(handler => {
            stopRequestHandler = handler;
            return () => {};
        });

        render(<GlobalRunListener />);

        stopRequestHandler!();

        expect(mockStop).toHaveBeenCalled();
    });

    it("cleans up event listeners on unmount", () => {
        const mockOffRun = vi.fn();
        const mockOffStop = vi.fn();

        mockOnRunRequested.mockReturnValue(mockOffRun);
        mockOnRunStopRequested.mockReturnValue(mockOffStop);

        const { unmount } = render(<GlobalRunListener />);

        unmount();

        expect(mockOffRun).toHaveBeenCalled();
        expect(mockOffStop).toHaveBeenCalled();
    });

    it("handles run requests with different file extensions", () => {
        mockIsRunnable.mockReturnValue(true);
        mockIsWaldiez.mockReturnValue(false);

        let runRequestHandler: (detail: any) => void;
        mockOnRunRequested.mockImplementation(handler => {
            runRequestHandler = handler;
            return () => {};
        });

        render(<GlobalRunListener />);

        // Test .py file
        mockExtOf.mockReturnValue(".py");
        runRequestHandler!({ path: "/test/script.py" });
        expect(mockRun).toHaveBeenCalledWith("/test/script.py", { args: [] });

        // Test .ipynb file
        mockExtOf.mockReturnValue(".ipynb");
        runRequestHandler!({ path: "/test/notebook.ipynb" });
        expect(mockRun).toHaveBeenCalledWith("/test/notebook.ipynb", { args: [] });

        // Test other file
        mockExtOf.mockReturnValue(".js");
        runRequestHandler!({ path: "/test/script.js" });
        expect(mockRun).toHaveBeenCalledWith("/test/script.js", { args: [] });
    });

    it("handles undefined or null paths gracefully", () => {
        mockIsRunnable.mockReturnValue(true);
        mockIsWaldiez.mockReturnValue(false);
        mockExtOf.mockReturnValue(".py");

        let runRequestHandler: (detail: any) => void;
        mockOnRunRequested.mockImplementation(handler => {
            runRequestHandler = handler;
            return () => {};
        });

        render(<GlobalRunListener />);

        // Should not crash with undefined path
        expect(() => {
            runRequestHandler!({ path: undefined });
        }).not.toThrow();

        expect(() => {
            runRequestHandler!({ path: null });
        }).not.toThrow();
    });

    it("preserves run request mode parameter", () => {
        mockIsRunnable.mockReturnValue(true);
        mockIsWaldiez.mockReturnValue(false);
        mockExtOf.mockReturnValue(".py");

        let runRequestHandler: (detail: any) => void;
        mockOnRunRequested.mockImplementation(handler => {
            runRequestHandler = handler;
            return () => {};
        });

        render(<GlobalRunListener />);

        const runRequest = { path: "/test/script.py", mode: "step" };
        runRequestHandler!(runRequest);

        // The mode parameter is not used in the current implementation
        // but the component should handle it without errors
        expect(mockRun).toHaveBeenCalledWith("/test/script.py", { args: [] });
    });
});
