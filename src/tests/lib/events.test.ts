/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import {
    bus,
    emitRunRequested,
    emitRunStopRequested,
    emitWorkspaceChanged,
    onRunRequested,
    onRunStopRequested,
    onWorkspaceChanged,
    type RunMode,
    type RunRequest,
} from "@/lib/events";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("events", () => {
    afterEach(() => {
        // Clear all event listeners after each test to prevent interference
        const newBus = new EventTarget();
        Object.setPrototypeOf(bus, Object.getPrototypeOf(newBus));
        Object.assign(bus, newBus);
    });

    describe("bus", () => {
        it("should export an EventTarget instance", () => {
            expect(bus).toBeInstanceOf(EventTarget);
        });
    });

    describe("workspace events", () => {
        describe("emitWorkspaceChanged", () => {
            it("should emit workspace changed event with detail", () => {
                const detail = { path: "/test/file.txt", parent: "/test" };
                const listener = vi.fn();

                bus.addEventListener("workspace:changed", listener);
                emitWorkspaceChanged(detail);

                expect(listener).toHaveBeenCalledTimes(1);
                expect(listener).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: "workspace:changed",
                        detail,
                    })
                );
            });

            it("should emit event with partial detail", () => {
                const detail = { path: "/test/file.txt" };
                const listener = vi.fn();

                bus.addEventListener("workspace:changed", listener);
                emitWorkspaceChanged(detail);

                expect(listener).toHaveBeenCalledWith(
                    expect.objectContaining({
                        detail,
                    })
                );
            });

            it("should emit event with empty detail", () => {
                const detail = {};
                const listener = vi.fn();

                bus.addEventListener("workspace:changed", listener);
                emitWorkspaceChanged(detail);

                expect(listener).toHaveBeenCalledWith(
                    expect.objectContaining({
                        detail,
                    })
                );
            });
        });

        describe("onWorkspaceChanged", () => {
            it("should listen to workspace changed events", () => {
                const handler = vi.fn();
                const detail = { path: "/test/file.txt", parent: "/test" };

                onWorkspaceChanged(handler);
                emitWorkspaceChanged(detail);

                expect(handler).toHaveBeenCalledTimes(1);
                expect(handler).toHaveBeenCalledWith(detail);
            });

            it("should handle events with no detail", () => {
                const handler = vi.fn();

                onWorkspaceChanged(handler);
                bus.dispatchEvent(new CustomEvent("workspace:changed"));

                expect(handler).toHaveBeenCalledWith({});
            });

            it("should return unsubscribe function", () => {
                const handler = vi.fn();
                const detail = { path: "/test/file.txt" };

                const unsubscribe = onWorkspaceChanged(handler);

                // Should receive event before unsubscribing
                emitWorkspaceChanged(detail);
                expect(handler).toHaveBeenCalledTimes(1);

                // Unsubscribe and verify no more events
                unsubscribe();
                emitWorkspaceChanged(detail);
                expect(handler).toHaveBeenCalledTimes(1); // Still only 1 call
            });

            it("should handle multiple listeners", () => {
                const handler1 = vi.fn();
                const handler2 = vi.fn();
                const detail = { path: "/test/file.txt" };

                onWorkspaceChanged(handler1);
                onWorkspaceChanged(handler2);

                emitWorkspaceChanged(detail);

                expect(handler1).toHaveBeenCalledWith(detail);
                expect(handler2).toHaveBeenCalledWith(detail);
            });
        });
    });

    describe("run events", () => {
        describe("emitRunRequested", () => {
            it("should emit run requested event with detail", () => {
                const detail: RunRequest = { path: "/test/script.py", mode: "chat" };
                const listener = vi.fn();

                bus.addEventListener("run:requested", listener);
                emitRunRequested(detail);

                expect(listener).toHaveBeenCalledTimes(1);
                expect(listener).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: "run:requested",
                        detail,
                    })
                );
            });

            it("should emit event without mode", () => {
                const detail: RunRequest = { path: "/test/script.py" };
                const listener = vi.fn();

                bus.addEventListener("run:requested", listener);
                emitRunRequested(detail);

                expect(listener).toHaveBeenCalledWith(
                    expect.objectContaining({
                        detail,
                    })
                );
            });

            it("should emit event with step mode", () => {
                const detail: RunRequest = { path: "/test/script.py", mode: "step" };
                const listener = vi.fn();

                bus.addEventListener("run:requested", listener);
                emitRunRequested(detail);

                expect(listener).toHaveBeenCalledWith(
                    expect.objectContaining({
                        detail,
                    })
                );
            });
        });

        describe("onRunRequested", () => {
            it("should listen to run requested events", () => {
                const handler = vi.fn();
                const detail: RunRequest = { path: "/test/script.py", mode: "chat" };

                onRunRequested(handler);
                emitRunRequested(detail);

                expect(handler).toHaveBeenCalledTimes(1);
                expect(handler).toHaveBeenCalledWith(detail);
            });

            it("should return unsubscribe function", () => {
                const handler = vi.fn();
                const detail: RunRequest = { path: "/test/script.py" };

                const unsubscribe = onRunRequested(handler);

                // Should receive event before unsubscribing
                emitRunRequested(detail);
                expect(handler).toHaveBeenCalledTimes(1);

                // Unsubscribe and verify no more events
                unsubscribe();
                emitRunRequested(detail);
                expect(handler).toHaveBeenCalledTimes(1); // Still only 1 call
            });

            it("should handle multiple listeners", () => {
                const handler1 = vi.fn();
                const handler2 = vi.fn();
                const detail: RunRequest = { path: "/test/script.py", mode: "step" };

                onRunRequested(handler1);
                onRunRequested(handler2);

                emitRunRequested(detail);

                expect(handler1).toHaveBeenCalledWith(detail);
                expect(handler2).toHaveBeenCalledWith(detail);
            });
        });

        describe("emitRunStopRequested", () => {
            it("should emit run stop requested event", () => {
                const listener = vi.fn();

                bus.addEventListener("run:stop", listener);
                emitRunStopRequested();

                expect(listener).toHaveBeenCalledTimes(1);
                expect(listener).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: "run:stop",
                    })
                );
            });

            it("should emit event without detail", () => {
                const listener = vi.fn();

                bus.addEventListener("run:stop", listener);
                emitRunStopRequested();

                const call = listener.mock.calls[0][0];
                expect(call.detail).toBeFalsy();
            });
        });

        describe("onRunStopRequested", () => {
            it("should listen to run stop requested events", () => {
                const handler = vi.fn();

                onRunStopRequested(handler);
                emitRunStopRequested();

                expect(handler).toHaveBeenCalledTimes(1);
                expect(handler).toHaveBeenCalledWith();
            });

            it("should return unsubscribe function", () => {
                const handler = vi.fn();

                const unsubscribe = onRunStopRequested(handler);

                // Should receive event before unsubscribing
                emitRunStopRequested();
                expect(handler).toHaveBeenCalledTimes(1);

                // Unsubscribe and verify no more events
                unsubscribe();
                emitRunStopRequested();
                expect(handler).toHaveBeenCalledTimes(1); // Still only 1 call
            });

            it("should handle multiple listeners", () => {
                const handler1 = vi.fn();
                const handler2 = vi.fn();

                onRunStopRequested(handler1);
                onRunStopRequested(handler2);

                emitRunStopRequested();

                expect(handler1).toHaveBeenCalledTimes(1);
                expect(handler2).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe("integration scenarios", () => {
        it("should handle mixed event types independently", () => {
            const workspaceHandler = vi.fn();
            const runHandler = vi.fn();
            const stopHandler = vi.fn();

            onWorkspaceChanged(workspaceHandler);
            onRunRequested(runHandler);
            onRunStopRequested(stopHandler);

            // Emit different events
            emitWorkspaceChanged({ path: "/test" });
            emitRunRequested({ path: "/script.py", mode: "chat" });
            emitRunStopRequested();

            expect(workspaceHandler).toHaveBeenCalledTimes(1);
            expect(runHandler).toHaveBeenCalledTimes(1);
            expect(stopHandler).toHaveBeenCalledTimes(1);
        });

        it("should handle rapid event sequences", () => {
            const handler = vi.fn();

            onWorkspaceChanged(handler);

            // Emit multiple events quickly
            for (let i = 0; i < 5; i++) {
                emitWorkspaceChanged({ path: `/test${i}` });
            }

            expect(handler).toHaveBeenCalledTimes(5);
        });

        it("should handle partial un-subscription", () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            const unsubscribe1 = onWorkspaceChanged(handler1);
            onWorkspaceChanged(handler2);

            // Both should receive first event
            emitWorkspaceChanged({ path: "/test1" });
            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledTimes(1);

            // Unsubscribe first handler
            unsubscribe1();

            // Only second handler should receive second event
            emitWorkspaceChanged({ path: "/test2" });
            expect(handler1).toHaveBeenCalledTimes(1); // Still 1
            expect(handler2).toHaveBeenCalledTimes(2); // Now 2
        });
    });

    describe("type safety", () => {
        it("should enforce RunMode types", () => {
            const chatMode: RunMode = "chat";
            const stepMode: RunMode = "step";

            expect(chatMode).toBe("chat");
            expect(stepMode).toBe("step");
        });

        it("should enforce RunRequest structure", () => {
            const request1: RunRequest = { path: "/test.py" };
            const request2: RunRequest = { path: "/test.py", mode: "chat" };

            expect(request1.path).toBe("/test.py");
            expect(request1.mode).toBeUndefined();
            expect(request2.mode).toBe("chat");
        });
    });
});
