/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import type { WaldiezChatConfig, WaldiezChatUserInput, WaldiezStepByStep } from "@waldiez/react";

export type WaldiezChatHandlers = {
    onUserInput: (input: WaldiezChatUserInput) => void;
    onInterrupt: () => void;
    onClose: () => void;
};

export type WaldiezStepHandlers = {
    sendControl: (payload: unknown) => void;
    respond: (payload: unknown) => void;
    close: () => void;
};

export type WaldiezState = {
    // chat
    chat: Partial<WaldiezChatConfig>;
    // step-by-step
    stepByStep: Partial<WaldiezStepByStep>;
    stdinRequest: { prompt: string; password: boolean } | null;
};

export type WaldiezMode = "chat" | "step";
