/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { WaldiezController } from "@/features/waldiez/controller";
import { useExec } from "@/store/exec";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WaldiezChatMessageProcessor, WaldiezStepByStepProcessor } from "@waldiez/react";

// Mock dependencies
vi.mock("@/store/exec", () => ({
    useExec: {
        getState: vi.fn(),
    },
}));

vi.mock("@waldiez/react", () => ({
    WaldiezChatMessageProcessor: {
        process: vi.fn(),
    },
    WaldiezStepByStepProcessor: {
        process: vi.fn(),
    },
}));

describe("WaldiezController", () => {
    let onState: ReturnType<typeof vi.fn>;
    let controller: WaldiezController;
    let mockGetState: ReturnType<typeof vi.fn>;
    let mockAddListener: ReturnType<typeof vi.fn>;
    let mockRun: ReturnType<typeof vi.fn>;
    let mockStop: ReturnType<typeof vi.fn>;
    let mockCtrl: any;

    beforeEach(() => {
        vi.clearAllMocks();

        onState = vi.fn();
        mockAddListener = vi.fn();
        mockRun = vi.fn();
        mockStop = vi.fn();
        mockCtrl = {
            stdin: vi.fn(),
            interrupt: vi.fn(),
            send: vi.fn(),
        };

        mockGetState = vi.fn().mockReturnValue({
            addListener: mockAddListener,
            run: mockRun,
            stop: mockStop,
            ctrl: mockCtrl,
        });

        vi.mocked(useExec).getState = mockGetState as any;
        mockAddListener.mockReturnValue(() => {}); // unsubscribe function

        controller = new WaldiezController(onState as any);
    });

    it("creates controller with state callback", () => {
        expect(controller).toBeInstanceOf(WaldiezController);
    });

    it("starts in chat mode by default", () => {
        controller.start("/test/flow.waldiez");

        expect(onState).toHaveBeenCalledWith(
            expect.objectContaining({
                chat: expect.objectContaining({
                    show: true,
                    active: true,
                }),
                stepByStep: expect.objectContaining({
                    show: false,
                    active: false,
                }),
            }),
        );
        expect(mockRun).toHaveBeenCalledWith("/test/flow.waldiez", { args: undefined });
    });

    it("starts in step mode when specified", () => {
        controller.start("/test/flow.waldiez", { mode: "step" });

        expect(onState).toHaveBeenCalledWith(
            expect.objectContaining({
                chat: expect.objectContaining({
                    show: false,
                    active: false,
                }),
                stepByStep: expect.objectContaining({
                    show: true,
                    active: true,
                }),
            }),
        );
        expect(mockRun).toHaveBeenCalledWith("/test/flow.waldiez", { args: ["--step"] });
    });

    it("provides chat handlers", () => {
        controller.start("/test/flow.waldiez");

        const chatState = onState.mock.calls[0][0].chat;
        expect(chatState.handlers.onUserInput).toBeInstanceOf(Function);
        expect(chatState.handlers.onInterrupt).toBeInstanceOf(Function);
        expect(chatState.handlers.onClose).toBeInstanceOf(Function);
    });

    it("provides step handlers", () => {
        controller.start("/test/flow.waldiez", { mode: "step" });

        const stepState = onState.mock.calls[0][0].stepByStep;
        expect(stepState.handlers.sendControl).toBeInstanceOf(Function);
        expect(stepState.handlers.respond).toBeInstanceOf(Function);
        expect(stepState.handlers.close).toBeInstanceOf(Function);
    });

    it("handles chat user input", () => {
        controller.start("/test/flow.waldiez");
        const chatHandlers = onState.mock.calls[0][0].chat.handlers;

        chatHandlers.onUserInput("test message");

        expect(mockCtrl.stdin).toHaveBeenCalledWith("test message");
        expect(onState).toHaveBeenCalledWith({
            stdinRequest: null,
            chat: { activeRequest: undefined },
        });
    });

    it("handles chat user input as object", () => {
        controller.start("/test/flow.waldiez");
        const chatHandlers = onState.mock.calls[0][0].chat.handlers;

        chatHandlers.onUserInput({ type: "message", content: "test" });

        expect(mockCtrl.stdin).toHaveBeenCalledWith('{"type":"message","content":"test"}');
    });

    it("handles chat interrupt", () => {
        controller.start("/test/flow.waldiez");
        const chatHandlers = onState.mock.calls[0][0].chat.handlers;

        chatHandlers.onInterrupt();

        expect(mockCtrl.interrupt).toHaveBeenCalled();
    });

    it("handles step control sending", () => {
        controller.start("/test/flow.waldiez", { mode: "step" });
        const stepHandlers = onState.mock.calls[0][0].stepByStep.handlers;

        stepHandlers.sendControl({ action: "continue" });

        expect(mockCtrl.send).toHaveBeenCalledWith({
            op: "waldiez_control",
            payload: { action: "continue", type: "debug_input_response" },
        });
    });

    it("handles step response", () => {
        controller.start("/test/flow.waldiez", { mode: "step" });
        const stepHandlers = onState.mock.calls[0][0].stepByStep.handlers;

        stepHandlers.respond({ response: "user input" });

        expect(mockCtrl.send).toHaveBeenCalledWith({
            op: "waldiez_respond",
            payload: { response: "user input", type: "input_response" },
        });
    });

    it("stops execution and cleans up", () => {
        const unsubscribe = vi.fn();
        mockAddListener.mockReturnValue(unsubscribe);

        controller.start("/test/flow.waldiez");
        controller.stop();

        expect(mockStop).toHaveBeenCalled();
        expect(unsubscribe).toHaveBeenCalled();
    });

    it("handles input_request events", () => {
        let eventHandler: (evt: any) => void;
        mockAddListener.mockImplementation(handler => {
            eventHandler = handler;
            return () => {};
        });

        controller.start("/test/flow.waldiez");

        eventHandler!({
            type: "input_request",
            data: { prompt: "Enter value:", password: false },
        });

        expect(onState).toHaveBeenCalledWith({
            stdinRequest: { prompt: "Enter value:", password: false },
        });
    });

    it("handles run_end events", () => {
        let eventHandler: (evt: any) => void;
        const unsubscribe = vi.fn();
        mockAddListener.mockImplementation(handler => {
            eventHandler = handler;
            return unsubscribe;
        });

        controller.start("/test/flow.waldiez");

        eventHandler!({ type: "run_end" });

        expect(onState).toHaveBeenCalledWith({
            stdinRequest: null,
            stepByStep: { active: false },
            chat: { active: false },
        });
        expect(unsubscribe).toHaveBeenCalled();
    });

    it("handles null ctrl gracefully", () => {
        mockGetState.mockReturnValue({
            addListener: mockAddListener,
            run: mockRun,
            stop: mockStop,
            ctrl: null,
        });

        controller.start("/test/flow.waldiez");
        const chatHandlers = onState.mock.calls[0][0].chat.handlers;

        expect(() => {
            chatHandlers.onUserInput("test");
            chatHandlers.onInterrupt();
        }).not.toThrow();
    });
    it("handles debug_input_request events", () => {
        let eventHandler!: (evt: any) => void;
        mockAddListener.mockImplementation(handler => {
            eventHandler = handler;
            return () => {};
        });

        controller.start("/test/flow.waldiez");

        eventHandler({
            type: "debug_input_request",
            data: { prompt: "Dbg:", password: true },
        });

        expect(onState).toHaveBeenCalledWith({
            stdinRequest: { prompt: "Dbg:", password: true },
        });
    });

    it("run_stdout parses multiple lines with embedded JSON (brace scan) and falls back to stdinRequest", () => {
        // Force processors to return undefined so fallback path is used
        vi.mocked(WaldiezChatMessageProcessor.process).mockReturnValue(undefined as any);
        vi.mocked(WaldiezStepByStepProcessor.process).mockReturnValue(undefined as any);

        let eventHandler!: (evt: any) => void;
        mockAddListener.mockImplementation(handler => {
            eventHandler = handler;
            return () => {};
        });

        controller.start("/test/flow.waldiez"); // mode doesn't matter for fallback

        const chunk = [
            "noise line",
            '{"garbage": "not an input request"}', // valid JSON but not matched -> ignored
            // embedded JSON in a noisy line -> should be extracted by brace scan:
            '... pre { "type":"input_request", "prompt":"Your name?", "password": false } post ...',
            // a debug request on its own line:
            '{ "type": "debug_input_request", "prompt": "Dbg?", "password": true }',
            // a line that looks like JSON but actually braces inside strings (should be ignored by scan)
            '{"text":"not { a } real object here"}',
        ].join("\n");

        eventHandler({ type: "run_stdout", data: { text: chunk } });

        // The last fallback set should be the debug_input_request
        const lastPatch = onState.mock.calls.at(-1)![0];
        expect(lastPatch.stdinRequest).toEqual({ prompt: "Dbg?", password: true });
    });

    it("chat mode: _applyChat populates activeRequest for input_request and clears it for normal message", () => {
        let eventHandler!: (evt: any) => void;
        mockAddListener.mockImplementation(handler => {
            eventHandler = handler;
            return () => {};
        });

        controller.start("/test/flow.waldiez"); // chat mode

        // 1) input_request message with requestId fallback
        vi.mocked(WaldiezChatMessageProcessor.process).mockReturnValueOnce({
            requestId: "req-1",
            message: { type: "input_request", prompt: "Type:", password: false },
            participants: [{ id: "u1" }],
            timeline: { t: 1 },
        } as any);

        eventHandler({ type: "run_stdout", data: { text: JSON.stringify({ a: 1 }) } });

        let patch = onState.mock.calls.at(-1)![0];
        expect(patch.chat.activeRequest).toEqual({
            request_id: "req-1",
            prompt: "Type:",
            password: false,
        });
        expect(patch.chat.messages).toEqual([{ type: "input_request", prompt: "Type:", password: false }]);
        expect(patch.chat.timeline).toEqual({ t: 1 });
        expect(patch.chat.userParticipants).toEqual([{ id: "u1" }]);

        // 2) normal message clears activeRequest and updates messages
        vi.mocked(WaldiezChatMessageProcessor.process).mockReturnValueOnce({
            message: { type: "text", content: "hello" },
        } as any);

        eventHandler({ type: "run_stdout", data: { text: JSON.stringify({ b: 2 }) } });

        patch = onState.mock.calls.at(-1)![0];
        expect(patch.chat.activeRequest).toBeUndefined();
        expect(patch.chat.messages).toEqual([{ type: "text", content: "hello" }]);
    });

    it("step mode: _applyStep sets & then clears pendingControlInput/activeRequest; also sets request id for later control", () => {
        let eventHandler!: (evt: any) => void;
        mockAddListener.mockImplementation(handler => {
            eventHandler = handler;
            return () => {};
        });

        controller.start("/test/flow.waldiez", { mode: "step" });

        // First update: both pendingControlInput and activeRequest present
        vi.mocked(WaldiezStepByStepProcessor.process).mockReturnValueOnce({
            stateUpdate: {
                currentEvent: { id: "e1" },
                eventHistory: [{ id: "h1" }],
                participants: [{ id: "p1" }],
                help: "help text",
                lastError: null,
                pendingControlInput: { request_id: "r-pending", prompt: "continue?" },
                activeRequest: { request_id: "r-active", prompt: "input?" },
                stepMode: true,
                autoContinue: false,
                breakpoints: [{ id: "bp1" }],
                timeline: { t: 1 },
            },
        } as any);

        eventHandler({ type: "run_stdout", data: { text: JSON.stringify({ s: 1 }) } as any });

        let patch = onState.mock.calls.at(-1)![0];
        expect(patch.stepByStep.currentEvent).toEqual({ id: "e1" });
        expect(patch.stepByStep.eventHistory).toEqual([{ id: "h1" }, { id: "e1" }]);
        expect(patch.stepByStep.participants).toEqual([{ id: "p1" }]);
        expect(patch.stepByStep.help).toBe("help text");
        expect(patch.stepByStep.lastError).toBeNull();
        expect(patch.stepByStep.pendingControlInput).toEqual({
            request_id: "r-pending",
            prompt: "continue?",
        });
        expect(patch.stepByStep.activeRequest).toEqual({ request_id: "r-active", prompt: "input?" });
        expect(patch.stepByStep.stepMode).toBe(true);
        expect(patch.stepByStep.autoContinue).toBe(false);
        expect(patch.stepByStep.breakpoints).toEqual([{ id: "bp1" }]);
        expect(patch.stepByStep.timeline).toEqual({ t: 1 });

        // The controller should have stored _currentRequestId from activeRequest.
        // Trigger a sendControl with missing request_id; it should inject "r-active".
        const stepState = onState.mock.calls[0][0].stepByStep; // handlers initially set on start()
        stepState.handlers.sendControl({ action: "go" } as any);
        expect(mockCtrl.send).toHaveBeenCalledWith({
            op: "waldiez_control",
            payload: { action: "go", type: "debug_input_response", request_id: "r-active" },
        });

        // Second update: explicit undefined s -> fields get cleared
        vi.mocked(WaldiezStepByStepProcessor.process).mockReturnValueOnce({
            stateUpdate: {
                pendingControlInput: undefined,
                activeRequest: undefined,
                stepMode: false,
                autoContinue: true,
                timeline: undefined,
            },
        } as any);

        eventHandler({ type: "run_stdout", data: { text: JSON.stringify({ s: 2 }) } as any });

        patch = onState.mock.calls.at(-1)![0];
        expect(patch.stepByStep.pendingControlInput).toBeUndefined();
        expect(patch.stepByStep.activeRequest).toBeUndefined();
        expect(patch.stepByStep.stepMode).toBe(false);
        expect(patch.stepByStep.autoContinue).toBe(true);
        // timeline omitted => not set; no assertion needed
    });

    it("step mode: when step processor returns undefined, chat processor can update participants/timeline via _applyStepFromChat", () => {
        let eventHandler!: (evt: any) => void;
        mockAddListener.mockImplementation(handler => {
            eventHandler = handler;
            return () => {};
        });

        controller.start("/test/flow.waldiez", { mode: "step" });

        // 1) participants branch
        vi.mocked(WaldiezStepByStepProcessor.process).mockReturnValueOnce(undefined as any);
        vi.mocked(WaldiezChatMessageProcessor.process).mockReturnValueOnce({
            participants: [{ id: "px" }],
        } as any);

        eventHandler({ type: "run_stdout", data: { text: JSON.stringify({ a: 1 }) } as any });
        let patch = onState.mock.calls.at(-1)![0];
        expect(patch.stepByStep.participants).toEqual([{ id: "px" }]);

        // 2) timeline branch
        vi.mocked(WaldiezStepByStepProcessor.process).mockReturnValueOnce(undefined as any);
        vi.mocked(WaldiezChatMessageProcessor.process).mockReturnValueOnce({
            timeline: { t: 42 },
        } as any);

        eventHandler({ type: "run_stdout", data: { text: JSON.stringify({ b: 2 }) } as any });
        patch = onState.mock.calls.at(-1)![0];
        expect(patch.stepByStep.timeline).toEqual({ t: 42 });
    });
});
