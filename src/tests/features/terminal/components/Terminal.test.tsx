/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import Terminal from "@/features/terminal/components/Terminal";
import { useXtermTheme } from "@/features/terminal/hooks/useXtermTheme";
import { openTerminal } from "@/lib/wsTerminal";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";

// Mock xterm and addons
const mockTerminal = {
    open: vi.fn(),
    dispose: vi.fn(),
    loadAddon: vi.fn(),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    write: vi.fn(),
    reset: vi.fn(),
    rows: 24,
    cols: 80,
};

const mockFitAddon = {
    fit: vi.fn(),
};

const mockSearchAddon = {};
const mockWebLinksAddon = {};

vi.mock("xterm", () => {
    const Terminal = vi.fn(
        class {
            constructor() {
                return mockTerminal;
            }
        },
    );
    return { Terminal };
});

vi.mock("xterm-addon-fit", () => {
    const FitAddon = vi.fn(
        class {
            constructor() {
                return mockFitAddon;
            }
        },
    );
    return { FitAddon };
});

vi.mock("xterm-addon-search", () => {
    const SearchAddon = vi.fn(
        class SearchAddon {
            constructor() {
                return mockSearchAddon;
            }
        },
    );
    return { SearchAddon };
});

vi.mock("xterm-addon-web-links", () => {
    const WebLinksAddon = vi.fn(
        class WebLinksAddon {
            constructor() {
                return mockWebLinksAddon;
            }
        },
    );
    return { WebLinksAddon };
});

// Mock CSS import
vi.mock("xterm/css/xterm.css", () => ({}));

// Mock terminal controller
const mockController = {
    send: vi.fn(),
    resize: vi.fn(),
    close: vi.fn(),
};

vi.mock("@/lib/wsTerminal", () => ({
    openTerminal: vi.fn(() => mockController),
}));

// Mock theme hook
vi.mock("@/features/terminal/hooks/useXtermTheme", () => ({
    useXtermTheme: vi.fn(),
}));

describe("Terminal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("creates and initializes xterm instance", () => {
        render(<Terminal />);

        expect(XTerm).toHaveBeenCalledWith({
            fontSize: 12,
            convertEol: true,
            cursorBlink: true,
            lineHeight: 1.2,
            scrollback: 8000,
        });

        expect(mockTerminal.loadAddon).toHaveBeenCalledTimes(3);
        expect(FitAddon).toHaveBeenCalled();
    });

    it("opens terminal in container", () => {
        const { container } = render(<Terminal />);

        const terminalContainer = container.querySelector(".h-full.w-full");
        expect(terminalContainer).toBeInTheDocument();
        expect(mockTerminal.open).toHaveBeenCalled();
        expect(mockFitAddon.fit).toHaveBeenCalled();
    });

    it("sets up data handler for user input", () => {
        render(<Terminal />);

        expect(mockTerminal.onData).toHaveBeenCalled();

        // Simulate user typing
        // @ts-expect-error Tuple type '[]' of length '0' has no element at index '0'
        const dataHandler = mockTerminal.onData.mock.calls[0][0];
        // @ts-expect-error might not be defined
        dataHandler("test input");

        expect(mockController.send).toHaveBeenCalledWith("test input");
    });

    it("opens terminal controller on mount", () => {
        render(<Terminal cwd="/test/dir" />);

        expect(openTerminal).toHaveBeenCalledWith("/test/dir", expect.any(Function), expect.any(Function));
    });

    it("uses default cwd when not provided", () => {
        render(<Terminal />);

        expect(openTerminal).toHaveBeenCalledWith(undefined, expect.any(Function), expect.any(Function));
    });

    it("writes data from controller to terminal", () => {
        render(<Terminal />);

        // Get the write callback
        const writeCallback = vi.mocked(openTerminal).mock.calls[0][1];

        writeCallback("terminal output");

        expect(mockTerminal.write).toHaveBeenCalledWith("terminal output");
    });

    it("handles session end callback", () => {
        render(<Terminal />);

        // Get the session end callback
        const sessionEndCallback = vi.mocked(openTerminal).mock.calls[0][2];

        // @ts-expect-error might not be defined
        sessionEndCallback();

        expect(mockTerminal.write).toHaveBeenCalledWith("\r\n\x1b[33m[session ended]\x1b[0m\r\n");
        expect(mockController.close).toHaveBeenCalled();
    });

    it("restarts session after delay on session end", () => {
        render(<Terminal />);

        const sessionEndCallback = vi.mocked(openTerminal).mock.calls[0][2];

        // Clear previous calls
        vi.mocked(openTerminal).mockClear();

        // @ts-expect-error might not be defined
        sessionEndCallback();

        // Fast-forward the timeout
        vi.advanceTimersByTime(150);

        expect(mockTerminal.reset).toHaveBeenCalled();
        expect(openTerminal).toHaveBeenCalledTimes(1); // New session created
    });

    it("does not restart session if component unmounted", () => {
        const { unmount } = render(<Terminal />);

        const sessionEndCallback = vi.mocked(openTerminal).mock.calls[0][2];

        unmount();
        // @ts-expect-error might not be defined
        sessionEndCallback();

        vi.mocked(openTerminal).mockClear();
        vi.advanceTimersByTime(150);

        expect(openTerminal).not.toHaveBeenCalled();
    });

    it("recreates controller when cwd changes", () => {
        const { rerender } = render(<Terminal cwd="/initial" />);

        expect(openTerminal).toHaveBeenCalledWith("/initial", expect.any(Function), expect.any(Function));

        // Change cwd
        rerender(<Terminal cwd="/changed" />);

        expect(mockController.close).toHaveBeenCalled();
        expect(openTerminal).toHaveBeenCalledWith("/changed", expect.any(Function), expect.any(Function));
    });

    it("applies theme using hook", () => {
        render(<Terminal />);

        expect(useXtermTheme).toHaveBeenCalledWith(expect.objectContaining({ current: mockTerminal }));
    });

    it("disposes data handler on unmount", () => {
        const mockDispose = vi.fn();
        mockTerminal.onData.mockReturnValue({ dispose: mockDispose });

        const { unmount } = render(<Terminal />);

        unmount();

        expect(mockDispose).toHaveBeenCalled();
    });

    it("handles multiple session restarts", () => {
        render(<Terminal />);

        const sessionEndCallback = vi.mocked(openTerminal).mock.calls[0][2];

        // First session end
        // @ts-expect-error might not be defined
        sessionEndCallback();
        vi.advanceTimersByTime(150);

        // Second session end
        const secondSessionEndCallback = vi.mocked(openTerminal).mock.calls[1][2];
        // @ts-expect-error might not be defined
        secondSessionEndCallback();
        vi.advanceTimersByTime(150);

        expect(mockTerminal.reset).toHaveBeenCalledTimes(2);
        expect(openTerminal).toHaveBeenCalledTimes(3); // Initial + 2 restarts
    });

    it("properly handles controller cleanup during cwd change", () => {
        const { rerender } = render(<Terminal cwd="/dir1" />);

        const firstController = mockController;

        // Mock a new controller for the second cwd
        const secondController = {
            send: vi.fn(),
            resize: vi.fn(),
            close: vi.fn(),
            interrupt: vi.fn(),
            terminate: vi.fn(),
            ready: vi.fn(),
        };
        vi.mocked(openTerminal).mockReturnValue(secondController);

        rerender(<Terminal cwd="/dir2" />);

        expect(firstController.close).toHaveBeenCalled();
    });
});
