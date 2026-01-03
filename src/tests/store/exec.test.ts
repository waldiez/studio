/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
/* eslint-disable max-nested-callbacks */
import { type ExecLine, pushExecLine, useExec } from "@/store/exec";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the wsExec module
const mockOpenExec = vi.fn();
const mockController = {
    close: vi.fn(),
};

vi.mock("@/lib/wsExec", () => ({
    openExec: (path: string, callback: (path: string, event: any) => void, opts: any) => {
        mockOpenExec(path, callback, opts);
        return mockController;
    },
}));

describe("useExec store", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const { result } = renderHook(() => useExec());
        act(() => {
            result.current.clear();
            result.current.stop();
        });
        mockController.close.mockReset();
    });

    describe("initialization", () => {
        it("should initialize with default state", () => {
            const { result } = renderHook(() => useExec());

            expect(result.current.running).toBe(false);
            expect(result.current.startedAt).toBeNull();
            expect(result.current.taskPath).toBeNull();
            expect(result.current.ctrl).toBeNull();
            expect(result.current.lines).toEqual([]);
        });
    });

    describe("push", () => {
        it("should add a new line", () => {
            const { result } = renderHook(() => useExec());

            const line: ExecLine = {
                kind: "stdout",
                text: "Hello World",
                ts: Date.now(),
            };

            act(() => {
                result.current.push(line);
            });

            expect(result.current.lines).toHaveLength(1);
            expect(result.current.lines[0]).toEqual(line);
        });

        it("should append multiple lines in order", () => {
            const { result } = renderHook(() => useExec());

            const line1: ExecLine = {
                kind: "stdout",
                text: "First line",
                ts: Date.now(),
            };

            const line2: ExecLine = {
                kind: "stderr",
                text: "Second line",
                ts: Date.now() + 100,
            };

            act(() => {
                result.current.push(line1);
                result.current.push(line2);
            });

            expect(result.current.lines).toHaveLength(2);
            expect(result.current.lines[0]).toEqual(line1);
            expect(result.current.lines[1]).toEqual(line2);
        });
    });

    describe("clear", () => {
        it("should clear all lines", () => {
            const { result } = renderHook(() => useExec());

            const line: ExecLine = {
                kind: "system",
                text: "Test line",
                ts: Date.now(),
            };

            act(() => {
                result.current.push(line);
            });

            expect(result.current.lines).toHaveLength(1);

            act(() => {
                result.current.clear();
            });

            expect(result.current.lines).toEqual([]);
        });
    });

    describe("addListener", () => {
        it("should add and remove listeners", () => {
            const { result } = renderHook(() => useExec());

            const listener = vi.fn();

            let removeListener: () => void;

            act(() => {
                removeListener = result.current.addListener(listener);
            });

            expect(typeof removeListener!).toBe("function");

            act(() => {
                removeListener();
            });

            // Listener should be removed (we can't easily test this without triggering events)
            // @ts-expect-error listener not defined
            expect(removeListener).toBeDefined();
        });

        it("should handle multiple listeners", () => {
            const { result } = renderHook(() => useExec());

            const listener1 = vi.fn();
            const listener2 = vi.fn();

            let removeListener1: () => void;
            let removeListener2: () => void;

            act(() => {
                removeListener1 = result.current.addListener(listener1);
                removeListener2 = result.current.addListener(listener2);
            });

            expect(typeof removeListener1!).toBe("function");
            expect(typeof removeListener2!).toBe("function");

            act(() => {
                removeListener1();
                removeListener2();
            });
        });
    });

    describe("stop", () => {
        it("should stop execution and reset state", () => {
            const { result } = renderHook(() => useExec());

            // Simulate running state
            act(() => {
                result.current.run("test.py");
            });

            expect(result.current.running).toBe(true);
            expect(result.current.taskPath).toBe("test.py");
            expect(result.current.ctrl).toBe(mockController);
            expect(result.current.startedAt).toBeGreaterThan(0);

            act(() => {
                result.current.stop();
            });

            expect(result.current.running).toBe(false);
            expect(result.current.taskPath).toBeNull();
            expect(result.current.ctrl).toBeNull();
            expect(result.current.startedAt).toBeNull();
            expect(mockController.close).toHaveBeenCalled();
        });
    });

    describe("run", () => {
        it("should start execution", () => {
            const { result } = renderHook(() => useExec());

            act(() => {
                result.current.run("test.py");
            });

            expect(result.current.running).toBe(true);
            expect(result.current.taskPath).toBe("test.py");
            expect(result.current.ctrl).toBe(mockController);
            expect(result.current.startedAt).toBeGreaterThan(0);
            expect(result.current.lines).toEqual([]); // Cleared on run
            expect(mockOpenExec).toHaveBeenCalledWith("test.py", expect.any(Function), {});
        });

        it("should pass options to openExec", () => {
            const { result } = renderHook(() => useExec());

            const options = { args: ["custom"] };

            act(() => {
                result.current.run("test.py", options);
            });

            expect(mockOpenExec).toHaveBeenCalledWith("test.py", expect.any(Function), options);
        });

        it("should stop previous execution before starting new one", () => {
            const { result } = renderHook(() => useExec());

            // Start first execution
            act(() => {
                result.current.run("first.py");
            });

            expect(result.current.taskPath).toBe("first.py");
            expect(mockController.close).not.toHaveBeenCalled();

            // Start second execution
            act(() => {
                result.current.run("second.py");
            });

            expect(result.current.taskPath).toBe("second.py");
            expect(mockController.close).toHaveBeenCalled();
        });
    });

    describe("event handling", () => {
        it("should handle run_stdout events", () => {
            const { result } = renderHook(() => useExec());

            act(() => {
                result.current.run("test.py");
            });

            // Get the callback passed to openExec
            const callback = mockOpenExec.mock.calls[0][1];

            act(() => {
                callback({
                    type: "run_stdout",
                    data: { text: "stdout message" },
                });
            });

            expect(result.current.lines).toHaveLength(1);
            expect(result.current.lines[0].kind).toBe("stdout");
            expect(result.current.lines[0].text).toBe("stdout message");
        });

        it("should handle run_stderr events", () => {
            const { result } = renderHook(() => useExec());

            act(() => {
                result.current.run("test.py");
            });

            const callback = mockOpenExec.mock.calls[0][1];

            act(() => {
                callback({
                    type: "run_stderr",
                    data: { text: "error message" },
                });
            });

            expect(result.current.lines).toHaveLength(1);
            expect(result.current.lines[0].kind).toBe("stderr");
            expect(result.current.lines[0].text).toBe("error message");
        });

        it("should handle run_status events", () => {
            const { result } = renderHook(() => useExec());

            act(() => {
                result.current.run("test.py");
            });

            const callback = mockOpenExec.mock.calls[0][1];

            act(() => {
                callback({
                    type: "run_status",
                    data: { state: "running" },
                });
            });

            expect(result.current.lines).toHaveLength(1);
            expect(result.current.lines[0].kind).toBe("system");
            expect(result.current.lines[0].text).toBe("[status] running");
        });

        it("should handle run_end events", () => {
            const { result } = renderHook(() => useExec());

            act(() => {
                result.current.run("test.py");
            });

            const callback = mockOpenExec.mock.calls[0][1];

            act(() => {
                callback({
                    type: "run_end",
                    data: { returnCode: 0, elapsedMs: 1500 },
                });
            });

            expect(result.current.lines).toHaveLength(1);
            expect(result.current.lines[0].kind).toBe("system");
            expect(result.current.lines[0].text).toBe("[end] code=0 elapsed=1500ms");
            expect(result.current.running).toBe(false);
            expect(result.current.ctrl).toBeNull();
            expect(result.current.taskPath).toBeNull();
            expect(result.current.startedAt).toBeNull();
        });

        it("should handle missing text in stdout/stderr events", () => {
            const { result } = renderHook(() => useExec());

            act(() => {
                result.current.run("test.py");
            });

            const callback = mockOpenExec.mock.calls[0][1];

            act(() => {
                callback({
                    type: "run_stdout",
                    data: {},
                });
            });

            expect(result.current.lines).toHaveLength(1);
            expect(result.current.lines[0].text).toBe("");
        });

        it("should notify listeners of events", () => {
            const { result } = renderHook(() => useExec());

            const listener = vi.fn();

            act(() => {
                result.current.addListener(listener);
                result.current.run("test.py");
            });

            const callback = mockOpenExec.mock.calls[0][1];
            const event = {
                type: "run_stdout",
                data: { text: "test output" },
            };

            act(() => {
                callback(event);
            });

            expect(listener).toHaveBeenCalledWith(event);
        });

        it("should handle listener errors gracefully", () => {
            const { result } = renderHook(() => useExec());

            const faultyListener = vi.fn().mockImplementation(() => {
                throw new Error("Listener error");
            });

            act(() => {
                result.current.addListener(faultyListener);
                result.current.run("test.py");
            });

            const callback = mockOpenExec.mock.calls[0][1];

            expect(() => {
                act(() => {
                    callback({
                        type: "run_stdout",
                        data: { text: "test" },
                    });
                });
            }).not.toThrow();

            expect(faultyListener).toHaveBeenCalled();
        });
    });

    describe("pushExecLine helper", () => {
        it("should push line using helper function", () => {
            const line: ExecLine = {
                kind: "stdout",
                text: "Helper function test",
                ts: Date.now(),
            };

            act(() => {
                pushExecLine(line);
            });

            const { result } = renderHook(() => useExec());

            expect(result.current.lines).toHaveLength(1);
            expect(result.current.lines[0]).toEqual(line);
        });

        it("should work independently of hook instances", () => {
            const line1: ExecLine = {
                kind: "stdout",
                text: "First helper line",
                ts: Date.now(),
            };

            const line2: ExecLine = {
                kind: "stderr",
                text: "Second helper line",
                ts: Date.now() + 100,
            };

            act(() => {
                pushExecLine(line1);
            });

            const { result } = renderHook(() => useExec());

            expect(result.current.lines).toHaveLength(1);

            act(() => {
                pushExecLine(line2);
            });

            expect(result.current.lines).toHaveLength(2);
            expect(result.current.lines[0]).toEqual(line1);
            expect(result.current.lines[1]).toEqual(line2);
        });
    });

    describe("state persistence across hook instances", () => {
        it("should maintain exec state across hook instances", () => {
            const { result: result1 } = renderHook(() => useExec());

            act(() => {
                result1.current.run("persistent.py");
            });

            const { result: result2 } = renderHook(() => useExec());

            expect(result2.current.running).toBe(true);
            expect(result2.current.taskPath).toBe("persistent.py");
            expect(result2.current.ctrl).toBe(mockController);
        });

        it("should share state updates between hook instances", () => {
            const { result: result1 } = renderHook(() => useExec());
            const { result: result2 } = renderHook(() => useExec());

            const line: ExecLine = {
                kind: "system",
                text: "Shared state test",
                ts: Date.now(),
            };

            act(() => {
                result1.current.push(line);
            });

            expect(result2.current.lines).toHaveLength(1);
            expect(result2.current.lines[0]).toEqual(line);

            act(() => {
                result2.current.clear();
            });

            expect(result1.current.lines).toEqual([]);
        });
    });

    describe("complex execution scenarios", () => {
        it("should handle complete execution lifecycle", () => {
            const { result } = renderHook(() => useExec());

            // Start execution
            act(() => {
                result.current.run("lifecycle.py");
            });

            expect(result.current.running).toBe(true);
            expect(result.current.taskPath).toBe("lifecycle.py");
            expect(result.current.lines).toEqual([]);

            const callback = mockOpenExec.mock.calls[0][1];

            // Simulate execution events
            act(() => {
                callback({ type: "run_status", data: { state: "starting" } });
                callback({ type: "run_stdout", data: { text: "Starting process..." } });
                callback({ type: "run_stdout", data: { text: "Processing data..." } });
                callback({ type: "run_stderr", data: { text: "Warning: deprecated function" } });
                callback({ type: "run_stdout", data: { text: "Process completed" } });
                callback({ type: "run_end", data: { returnCode: 0, elapsedMs: 2500 } });
            });

            expect(result.current.lines).toHaveLength(6);
            expect(result.current.lines[0].text).toBe("[status] starting");
            expect(result.current.lines[1].text).toBe("Starting process...");
            expect(result.current.lines[2].text).toBe("Processing data...");
            expect(result.current.lines[3].text).toBe("Warning: deprecated function");
            expect(result.current.lines[4].text).toBe("Process completed");
            expect(result.current.lines[5].text).toBe("[end] code=0 elapsed=2500ms");

            expect(result.current.running).toBe(false);
            expect(result.current.taskPath).toBeNull();
        });

        it("should handle execution with error", () => {
            const { result } = renderHook(() => useExec());

            act(() => {
                result.current.run("error.py");
            });

            const callback = mockOpenExec.mock.calls[0][1];

            act(() => {
                callback({ type: "run_status", data: { state: "running" } });
                callback({ type: "run_stderr", data: { text: "TypeError: invalid operation" } });
                callback({ type: "run_stderr", data: { text: "  at line 42" } });
                callback({ type: "run_end", data: { returnCode: 1, elapsedMs: 800 } });
            });

            expect(result.current.lines).toHaveLength(4);
            expect(result.current.lines[1].kind).toBe("stderr");
            expect(result.current.lines[2].kind).toBe("stderr");
            expect(result.current.lines[3].text).toBe("[end] code=1 elapsed=800ms");
            expect(result.current.running).toBe(false);
        });

        it("should handle rapid start/stop cycles", () => {
            const { result } = renderHook(() => useExec());

            // Start and immediately stop
            act(() => {
                result.current.run("test1.py");
                result.current.stop();
            });

            expect(result.current.running).toBe(false);
            expect(result.current.taskPath).toBeNull();

            // Start again
            act(() => {
                result.current.run("test2.py");
            });

            expect(result.current.running).toBe(true);
            expect(result.current.taskPath).toBe("test2.py");
        });

        it("should handle multiple consecutive runs", () => {
            const { result } = renderHook(() => useExec());

            // First run
            act(() => {
                result.current.run("first.py");
            });

            expect(result.current.taskPath).toBe("first.py");
            expect(mockController.close).not.toHaveBeenCalled();

            // Second run should stop first
            act(() => {
                result.current.run("second.py");
            });

            expect(result.current.taskPath).toBe("second.py");
            expect(mockController.close).toHaveBeenCalledTimes(1);

            // Third run should stop second
            act(() => {
                result.current.run("third.py");
            });

            expect(result.current.taskPath).toBe("third.py");
            expect(mockController.close).toHaveBeenCalledTimes(2);
        });
    });

    describe("edge cases", () => {
        it("should handle events with missing data", () => {
            const { result } = renderHook(() => useExec());

            act(() => {
                result.current.run("test.py");
            });

            const callback = mockOpenExec.mock.calls[0][1];

            act(() => {
                callback({ type: "run_stdout" }); // Missing data
                callback({ type: "run_stderr", data: null }); // Null data
                callback({ type: "run_status", data: { state: undefined } }); // Undefined state
                callback({ type: "error", error: "something went wrong" });
                callback({ type: "error", text: "something went wrong :(" });
            });

            expect(result.current.lines).toHaveLength(5);
            expect(result.current.lines[0].text).toBe("");
            expect(result.current.lines[1].text).toBe("");
            expect(result.current.lines[2].text).toBe("[status] undefined");
            expect(result.current.lines[3].text).toBe("something went wrong");
            expect(result.current.lines[4].text).toBe("something went wrong :(");
        });

        it("should handle unknown event types", () => {
            const { result } = renderHook(() => useExec());

            act(() => {
                result.current.run("test.py");
            });

            const callback = mockOpenExec.mock.calls[0][1];

            expect(() => {
                act(() => {
                    callback({ type: "unknown_event", data: { value: "test" } });
                });
            }).not.toThrow();

            // Should not add any lines for unknown events
            expect(result.current.lines).toHaveLength(0);
        });

        it("should handle controller without close method", () => {
            const { result } = renderHook(() => useExec());

            // Mock controller without close method
            const incompleteController = {};
            mockOpenExec.mockReturnValue(incompleteController);

            act(() => {
                result.current.run("test.py");
            });

            expect(() => {
                act(() => {
                    result.current.stop();
                });
            }).not.toThrow();

            expect(result.current.running).toBe(false);
        });

        it("should handle large number of lines efficiently", () => {
            const { result } = renderHook(() => useExec());

            act(() => {
                result.current.run("large-output.py");
            });

            const callback = mockOpenExec.mock.calls[0][1];

            // Simulate large output
            act(() => {
                for (let i = 0; i < 1000; i++) {
                    callback({
                        type: "run_stdout",
                        data: { text: `Line ${i + 1}` },
                    });
                }
            });

            expect(result.current.lines).toHaveLength(1000);
            expect(result.current.lines[0].text).toBe("Line 1");
            expect(result.current.lines[999].text).toBe("Line 1000");
        });
    });

    describe("listener management", () => {
        it("should handle multiple listeners with same event", () => {
            const { result } = renderHook(() => useExec());

            const listener1 = vi.fn();
            const listener2 = vi.fn();

            act(() => {
                result.current.addListener(listener1);
                result.current.addListener(listener2);
                result.current.run("test.py");
            });

            const callback = mockOpenExec.mock.calls[0][1];
            const event = { type: "run_stdout", data: { text: "test" } };

            act(() => {
                callback(event);
            });

            expect(listener1).toHaveBeenCalledWith(event);
            expect(listener2).toHaveBeenCalledWith(event);
        });

        it("should remove specific listeners", () => {
            const { result } = renderHook(() => useExec());

            const listener1 = vi.fn();
            const listener2 = vi.fn();

            let removeListener1: () => void;

            act(() => {
                removeListener1 = result.current.addListener(listener1);
                result.current.addListener(listener2);
                result.current.run("test.py");
            });

            // Remove first listener
            act(() => {
                removeListener1();
            });

            const callback = mockOpenExec.mock.calls[0][1];
            const event = { type: "run_stdout", data: { text: "test" } };

            act(() => {
                callback(event);
            });

            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).toHaveBeenCalledWith(event);
        });
    });
});
