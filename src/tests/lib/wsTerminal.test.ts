/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { wsPrefix } from "@/env";
import { openTerminal, type TermController } from "@/lib/wsTerminal";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock WebSocket
class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;

    constructor(public url: string) {}

    send = vi.fn();
    close = vi.fn();

    // Helper methods for testing
    simulateOpen() {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.(new Event("open"));
    }

    simulateMessage(data: any) {
        const event = { data: JSON.stringify(data) } as MessageEvent;
        this.onmessage?.(event);
    }

    simulateClose() {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.(new CloseEvent("close"));
    }

    simulateError() {
        this.onerror?.(new Event("error"));
    }

    simulateInvalidMessage() {
        const event = { data: "invalid json" } as MessageEvent;
        this.onmessage?.(event);
    }
}

// Mock window.location
Object.defineProperty(window, "location", {
    value: {
        protocol: "http:",
        host: "localhost:3000",
    },
    writable: true,
});

const WebSocketMock = vi.fn(
    class WebSocket {
        constructor(url: string) {
            return new MockWebSocket(url);
        }
    }
);

// Copy static properties
(WebSocketMock as any).CONNECTING = MockWebSocket.CONNECTING;
(WebSocketMock as any).OPEN = MockWebSocket.OPEN;
(WebSocketMock as any).CLOSING = MockWebSocket.CLOSING;
(WebSocketMock as any).CLOSED = MockWebSocket.CLOSED;
vi.stubGlobal("WebSocket", WebSocketMock);

describe("wsTerminal", () => {
    let mockWs: MockWebSocket;
    let onData: ReturnType<typeof vi.fn>;
    let onExit: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onData = vi.fn();
        onExit = vi.fn();
        vi.clearAllMocks();
    });

    describe("openTerminal", () => {
        it("should create WebSocket with correct URL", () => {
            openTerminal("/test/dir", onData as any, onExit as any);

            expect(global.WebSocket).toHaveBeenCalledWith(
                // cspell: disable-next-line
                `ws://localhost:3000${wsPrefix}/terminal?cwd=test%2Fdir`
            );
        });

        it("should create WebSocket without cwd parameter", () => {
            openTerminal(undefined, onData as any, onExit as any);

            expect(global.WebSocket).toHaveBeenCalledWith(
                `ws://localhost:3000${wsPrefix}/terminal?`
            );
        });

        it("should strip leading slashes from cwd", () => {
            openTerminal("///test/dir", onData as any, onExit as any);

            expect(global.WebSocket).toHaveBeenCalledWith(
                // cspell: disable-next-line
                `ws://localhost:3000${wsPrefix}/terminal?cwd=test%2Fdir`
            );
        });

        it("should use wss protocol for https", () => {
            Object.defineProperty(window, "location", {
                value: {
                    protocol: "https:",
                    host: "example.com",
                },
                writable: true,
            });

            openTerminal("/test", onData as any, onExit as any);

            expect(global.WebSocket).toHaveBeenCalledWith(
                `wss://example.com${wsPrefix}/terminal?cwd=test`
            );
        });

        it("should send start message on WebSocket open", () => {
            openTerminal("/test", onData as any, onExit as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            mockWs.simulateOpen();

            expect(mockWs.send).toHaveBeenCalledWith(
                JSON.stringify({ op: "start" })
            );
        });

        it("should handle data messages", () => {
            openTerminal("/test", onData as any, onExit as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            mockWs.simulateOpen();
            mockWs.simulateMessage({
                type: "data",
                data: "Hello from terminal"
            });

            expect(onData).toHaveBeenCalledWith("Hello from terminal");
        });

        it("should handle session_end messages", () => {
            openTerminal("/test", onData as any, onExit as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            mockWs.simulateOpen();
            mockWs.simulateMessage({ type: "session_end" });

            expect(onExit).toHaveBeenCalled();
        });

        it("should ignore invalid JSON messages", () => {
            openTerminal("/test", onData as any, onExit as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            mockWs.simulateOpen();
            mockWs.simulateInvalidMessage();

            expect(onData).not.toHaveBeenCalled();
            expect(onExit).not.toHaveBeenCalled();
        });

        it("should ignore unknown message types", () => {
            openTerminal("/test", onData as any, onExit as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            mockWs.simulateOpen();
            mockWs.simulateMessage({ type: "unknown", data: "test" });

            expect(onData).not.toHaveBeenCalled();
            expect(onExit).not.toHaveBeenCalled();
        });

        it("should work without onExit callback", () => {
            openTerminal("/test", onData as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            mockWs.simulateOpen();
            mockWs.simulateMessage({ type: "session_end" });

            // Should not throw error
            expect(onExit).not.toHaveBeenCalled();
        });

        it("should handle WebSocket close", () => {
            const controller = openTerminal("/test", onData as any, onExit as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            mockWs.simulateOpen();
            expect(controller.ready()).toBe(true);

            mockWs.simulateClose();
            expect(controller.ready()).toBe(false);
        });

        it("should handle WebSocket error", () => {
            openTerminal("/test", onData as any, onExit as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            // Should not throw error
            expect(() => mockWs.simulateError()).not.toThrow();
        });
    });

    describe("TermController", () => {
        let controller: TermController;

        beforeEach(() => {
            controller = openTerminal("/test", onData as any, onExit as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;
        });

        describe("send", () => {
            it("should send stdin message when WebSocket is open", () => {
                mockWs.simulateOpen();
                vi.clearAllMocks(); // Clear the start message

                controller.send("echo hello");

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "stdin", data: "echo hello" })
                );
            });

            it("should queue message when WebSocket is not open", () => {
                // Don't simulate open, so WebSocket is still connecting
                controller.send("echo hello");

                // Message should be queued, not sent immediately
                expect(mockWs.send).not.toHaveBeenCalled();

                // When WebSocket opens, queued message should be sent after start
                mockWs.simulateOpen();

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "start" })
                );
                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "stdin", data: "echo hello" })
                );
            });
        });

        describe("resize", () => {
            it("should send resize message when WebSocket is open", () => {
                mockWs.simulateOpen();
                vi.clearAllMocks();

                controller.resize(30, 120);

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "resize", rows: 30, cols: 120 })
                );
            });

            it("should queue resize message when WebSocket is not open", () => {
                controller.resize(25, 80);

                expect(mockWs.send).not.toHaveBeenCalled();

                mockWs.simulateOpen();

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "start" })
                );
                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "resize", rows: 25, cols: 80 })
                );
            });
        });

        describe("interrupt", () => {
            it("should send interrupt message when WebSocket is open", () => {
                mockWs.simulateOpen();
                vi.clearAllMocks();

                controller.interrupt();

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "interrupt" })
                );
            });

            it("should queue interrupt message when WebSocket is not open", () => {
                controller.interrupt();

                expect(mockWs.send).not.toHaveBeenCalled();

                mockWs.simulateOpen();

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "start" })
                );
                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "interrupt" })
                );
            });
        });

        describe("terminate", () => {
            it("should send terminate message when WebSocket is open", () => {
                mockWs.simulateOpen();
                vi.clearAllMocks();

                controller.terminate();

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "terminate" })
                );
            });

            it("should queue terminate message when WebSocket is not open", () => {
                controller.terminate();

                expect(mockWs.send).not.toHaveBeenCalled();

                mockWs.simulateOpen();

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "start" })
                );
                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "terminate" })
                );
            });
        });

        describe("close", () => {
            it("should close WebSocket", () => {
                controller.close();

                expect(mockWs.close).toHaveBeenCalled();
            });
        });

        describe("ready", () => {
            it("should return false when WebSocket is not open", () => {
                expect(controller.ready()).toBe(false);
            });

            it("should return true when WebSocket is open", () => {
                mockWs.simulateOpen();
                expect(controller.ready()).toBe(true);
            });

            it("should return false after WebSocket closes", () => {
                mockWs.simulateOpen();
                expect(controller.ready()).toBe(true);

                mockWs.simulateClose();
                expect(controller.ready()).toBe(false);
            });
        });
    });

    describe("message queuing", () => {
        it("should queue multiple messages and send them in order", () => {
            const controller = openTerminal("/test", onData as any, onExit as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            // Send multiple messages before WebSocket opens
            controller.send("command1");
            controller.resize(24, 80);
            controller.send("command2");
            controller.interrupt();

            expect(mockWs.send).not.toHaveBeenCalled();

            // When WebSocket opens, all messages should be sent in order
            mockWs.simulateOpen();

            expect(mockWs.send).toHaveBeenCalledTimes(5); // start + 4 queued messages
            expect(mockWs.send).toHaveBeenNthCalledWith(1, JSON.stringify({ op: "start" }));
            expect(mockWs.send).toHaveBeenNthCalledWith(2, JSON.stringify({ op: "stdin", data: "command1" }));
            expect(mockWs.send).toHaveBeenNthCalledWith(3, JSON.stringify({ op: "resize", rows: 24, cols: 80 }));
            expect(mockWs.send).toHaveBeenNthCalledWith(4, JSON.stringify({ op: "stdin", data: "command2" }));
            expect(mockWs.send).toHaveBeenNthCalledWith(5, JSON.stringify({ op: "interrupt" }));
        });

        it("should ensure start message goes first even if queued later", () => {
            const controller = openTerminal("/test", onData as any, onExit as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            // Send message before open
            controller.send("early command");

            mockWs.simulateOpen();

            // Start should go first, then the queued command
            expect(mockWs.send).toHaveBeenNthCalledWith(1, JSON.stringify({ op: "start" }));
            expect(mockWs.send).toHaveBeenNthCalledWith(2, JSON.stringify({ op: "stdin", data: "early command" }));
        });
    });

    describe("message handling edge cases", () => {
        it("should handle data message without data field", () => {
            openTerminal("/test", onData as any, onExit as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            mockWs.simulateOpen();
            mockWs.simulateMessage({ type: "data" });

            expect(onData).toHaveBeenCalledWith(undefined);
        });

        it("should handle messages with null data", () => {
            openTerminal("/test", onData as any, onExit as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            mockWs.simulateOpen();
            mockWs.simulateMessage({ type: "data", data: null });

            expect(onData).toHaveBeenCalledWith(null);
        });

        it("should handle empty messages", () => {
            openTerminal("/test", onData as any, onExit as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            mockWs.simulateOpen();
            mockWs.simulateMessage({});

            expect(onData).not.toHaveBeenCalled();
            expect(onExit).not.toHaveBeenCalled();
        });
    });

    describe("type definitions", () => {
        it("should define TermController interface correctly", () => {
            const controller = openTerminal("/test", onData as any, onExit as any);

            expect(typeof controller.send).toBe("function");
            expect(typeof controller.resize).toBe("function");
            expect(typeof controller.interrupt).toBe("function");
            expect(typeof controller.terminate).toBe("function");
            expect(typeof controller.close).toBe("function");
            expect(typeof controller.ready).toBe("function");
        });
    });
});
