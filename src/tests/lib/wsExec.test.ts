/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { wsPrefix } from "@/env";
import { openExec, type ExecController, type StartOptions } from "@/lib/wsExec";
import type { ExecEvent } from "@/types/events";
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

    simulateError() {
        this.onerror?.(new Event("error"));
    }

    simulateMalformedMessage() {
        const event = { data: "invalid json" } as MessageEvent;
        this.onmessage?.(event);
    }
}

// Mock window.location
Object.defineProperty(window, "location", {
    value: {
        origin: "http://localhost:3000",
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

(WebSocketMock as any).CONNECTING = MockWebSocket.CONNECTING;
(WebSocketMock as any).OPEN = MockWebSocket.OPEN;
(WebSocketMock as any).CLOSING = MockWebSocket.CLOSING;
(WebSocketMock as any).CLOSED = MockWebSocket.CLOSED;

vi.stubGlobal("WebSocket", WebSocketMock);


describe("wsExec", () => {
    let mockWs: MockWebSocket;
    let onEvent: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onEvent = vi.fn();
        vi.clearAllMocks();
    });

    describe("openExec", () => {
        it("should create WebSocket with correct URL", () => {
            openExec("/test/script.py", onEvent as any);
            const raw = (global.WebSocket as any).mock.calls[0][0] as string;
            const u = new URL(raw);
            expect(u.protocol).toBe("ws:");
            expect(u.host).toBe("localhost:3000");
            expect(u.pathname).toBe(wsPrefix);
            expect(u.searchParams.get("path")).toBe("/test/script.py");
        });

        it("should send start message on WebSocket open", () => {
            openExec("/test/script.py", onEvent as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            mockWs.simulateOpen();

            expect(mockWs.send).toHaveBeenCalledWith('{"op":"start"}');
        });

        it("should send start message with options", () => {
            const startOptions: StartOptions = {
                args: ["--verbose"],
                env: { NODE_ENV: "test" },
                cwd: "/custom/dir",
                venv: "my-env",
                freshKernel: true,
            };

            openExec("/test/script.py", onEvent  as any, startOptions);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            mockWs.simulateOpen();

            expect(mockWs.send).toHaveBeenCalledWith(
                JSON.stringify({ op: "start", ...startOptions })
            );
        });

        it("should handle incoming messages", () => {
            openExec("/test/script.py", onEvent as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            const testEvent: ExecEvent = {
                type: "run_stdout",
                data: { text: "Hello World" },
            };

            mockWs.simulateMessage(testEvent);

            expect(onEvent).toHaveBeenCalledWith(testEvent);
        });

        it("should handle malformed messages", () => {
            openExec("/test/script.py", onEvent as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            mockWs.simulateMalformedMessage();

            expect(onEvent).toHaveBeenCalledWith({
                type: "error",
                data: { message: "Malformed message" },
            });
        });

        it("should handle WebSocket errors", () => {
            openExec("/test/script.py", onEvent as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;

            mockWs.simulateError();

            expect(onEvent).toHaveBeenCalledWith({
                type: "error",
                data: { message: "WebSocket error" },
            });
        });
    });

    describe("ExecController", () => {
        let controller: ExecController;

        beforeEach(() => {
            controller = openExec("/test/script.py", onEvent as any);
            mockWs = (global.WebSocket as any).mock.results[0].value;
            mockWs.simulateOpen();
            vi.clearAllMocks(); // Clear the start message call
        });

        describe("stdin", () => {
            it("should send stdin message", () => {
                controller.stdin("input text");

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "stdin", text: "input text" })
                );
            });
        });

        describe("stdinEOF", () => {
            it("should send stdin_eof message", () => {
                controller.stdinEOF();

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "stdin_eof" })
                );
            });
        });

        describe("interrupt", () => {
            it("should send interrupt message", () => {
                controller.interrupt();

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "interrupt" })
                );
            });
        });

        describe("terminate", () => {
            it("should send terminate message", () => {
                controller.terminate();

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "terminate" })
                );
            });
        });

        describe("kill", () => {
            it("should send kill message", () => {
                controller.kill();

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "kill" })
                );
            });
        });

        describe("shutdown", () => {
            it("should send shutdown message", () => {
                controller.shutdown();

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "shutdown" })
                );
            });
        });

        describe("close", () => {
            it("should send shutdown message", () => {
                controller.close();

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify({ op: "shutdown" })
                );
            });
        });

        describe("send", () => {
            it("should send custom message", () => {
                const customMessage = { custom: "data", value: 123 };

                controller.send(customMessage);

                expect(mockWs.send).toHaveBeenCalledWith(
                    JSON.stringify(customMessage)
                );
            });

            it("should not send when WebSocket is not open", () => {
                mockWs.readyState = MockWebSocket.CLOSED;

                controller.send({ test: "message" });

                expect(mockWs.send).not.toHaveBeenCalled();
            });
        });

        describe("socket", () => {
            it("should expose WebSocket instance", () => {
                expect(controller.socket).toBe(mockWs);
            });
        });
    });

    describe("URL construction", () => {
        it("should handle paths with special characters", () => {
            openExec("/test/file with spaces.py", onEvent as any);

            const raw = (global.WebSocket as any).mock.calls[0][0] as string;
            const u = new URL(raw);
            expect(u.protocol).toBe("ws:");
            expect(u.host).toBe("localhost:3000");
            expect(u.pathname).toBe(wsPrefix);
            expect(u.searchParams.get("path")).toBe("/test/file with spaces.py");
        });

        it("should handle https origin", () => {
            Object.defineProperty(window, "location", {
                value: { origin: "https://example.com" },
                writable: true,
            });

            openExec("/test/script.py", onEvent as any);
            const raw = (global.WebSocket as any).mock.calls[0][0] as string;
            const u = new URL(raw);
            expect(u.protocol).toBe("wss:");
            expect(u.host).toBe("example.com");
        });
    });

    describe("type definitions", () => {
        it("should define StartOptions correctly", () => {
            const options: StartOptions = {
                args: ["--flag"],
                env: { VAR: "value" },
                cwd: "/path",
                venv: "env",
                freshKernel: true,
            };

            expect(options.args).toEqual(["--flag"]);
            expect(options.env).toEqual({ VAR: "value" });
            expect(options.cwd).toBe("/path");
            expect(options.venv).toBe("env");
            expect(options.freshKernel).toBe(true);
        });

        it("should define ExecController interface", () => {
            const controller = openExec("/test.py", onEvent as any);

            expect(typeof controller.stdin).toBe("function");
            expect(typeof controller.stdinEOF).toBe("function");
            expect(typeof controller.interrupt).toBe("function");
            expect(typeof controller.terminate).toBe("function");
            expect(typeof controller.kill).toBe("function");
            expect(typeof controller.shutdown).toBe("function");
            expect(typeof controller.close).toBe("function");
            expect(typeof controller.send).toBe("function");
            expect(controller.socket).toBeInstanceOf(MockWebSocket);
        });
    });
});
