/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import type { WaldiezMode, WaldiezState } from "@/features/waldiez/types";
import { describe, expect, it } from "vitest";

describe("Waldiez Types", () => {
    it("exports correct WaldiezMode values", () => {
        const chatMode: WaldiezMode = "chat";
        const stepMode: WaldiezMode = "step";

        expect(chatMode).toBe("chat");
        expect(stepMode).toBe("step");
    });

    it("defines WaldiezState structure", () => {
        const state: WaldiezState = {
            chat: {
                show: false,
                active: false,
                messages: [],
                userParticipants: [],
            },
            stepByStep: {
                show: false,
                active: false,
                stepMode: true,
                autoContinue: false,
                breakpoints: [],
                eventHistory: [],
                participants: [],
                pendingControlInput: null,
                activeRequest: null,
            },
            stdinRequest: null,
        };

        expect(state.chat).toBeDefined();
        expect(state.stepByStep).toBeDefined();
        expect(state.stdinRequest).toBeNull();
    });

    it("supports partial chat config", () => {
        const state: WaldiezState = {
            chat: { show: true }, // partial
            stepByStep: {},
            stdinRequest: { prompt: "test", password: false },
        };

        expect(state.chat.show).toBe(true);
        expect(state.stdinRequest?.prompt).toBe("test");
    });
});
