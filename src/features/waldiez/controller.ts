/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
/* eslint-disable max-statements */
import { useExec } from "@/store/exec";
import type { ExecEvent } from "@/types/events";

import {
    type WaldiezChatConfig,
    type WaldiezChatMessageProcessingResult,
    WaldiezChatMessageProcessor,
    type WaldiezChatUserInput,
    type WaldiezStepByStep,
    type WaldiezStepByStepProcessingResult,
    WaldiezStepByStepProcessor,
} from "@waldiez/react";

import type { WaldiezChatHandlers, WaldiezMode, WaldiezState, WaldiezStepHandlers } from "./types";

export class WaldiezController {
    private _unsubscribe: (() => void) | null = null;
    private _currentRequestId: string | undefined = undefined;
    private _mode: WaldiezMode = "chat"; // default

    constructor(private _onState: (patch: Partial<WaldiezState>) => void) {}

    start(path: string, opts: { mode?: WaldiezMode } = {}) {
        this._mode = opts.mode ?? "chat";

        this._onState({
            stdinRequest: null,
            chat: {
                show: this._mode === "chat",
                active: this._mode === "chat",
                messages: [],
                activeRequest: undefined,
                error: undefined,
                userParticipants: undefined,
                timeline: undefined,
                mediaConfig: undefined,
                handlers: this.chatHandlers(),
            } as Partial<WaldiezChatConfig>,
            stepByStep: {
                show: this._mode === "step",
                active: this._mode === "step",
                stepMode: true,
                autoContinue: false,
                breakpoints: [],
                eventHistory: [],
                currentEvent: undefined,
                participants: [],
                pendingControlInput: null,
                activeRequest: null,
                handlers: this.stepHandlers(),
            } as Partial<WaldiezStepByStep>,
        });

        this._unsubscribe?.();
        this._unsubscribe = useExec.getState().addListener(this._onExecEvent);
        useExec.getState().run(path, { args: this._mode === "step" ? ["--step"] : undefined });
    }

    stop() {
        this._unsubscribe?.();
        this._unsubscribe = null;
        useExec.getState().stop();
    }

    private closeChat() {
        this.stop();
        this._onState({
            chat: {
                show: false,
                active: false,
                messages: [],
                activeRequest: undefined,
                error: undefined,
                userParticipants: undefined,
                timeline: undefined,
                mediaConfig: undefined,
                // handlers: undefined,
            },
        });
    }

    private closeStep() {
        this.stop();
        this._onState({
            stepByStep: {
                show: false,
                active: false,
                eventHistory: [],
                currentEvent: undefined,
                timeline: undefined,
                participants: undefined,
                lastError: undefined,
                activeRequest: undefined,
                autoContinue: false,
                stepMode: undefined,
                stats: undefined,
            },
        });
    }

    private getCtrl() {
        return useExec.getState().ctrl ?? null;
    }

    private _onExecEvent = (evt: ExecEvent) => {
        if (evt.type === "run_stdout") {
            this._handleStdout(evt.data.text ?? "");
            return;
        }
        if (evt.type === "input_request" || evt.type === "debug_input_request") {
            this._onState({
                stdinRequest: { prompt: evt.data.prompt, password: !!evt.data.password },
            });
            return;
        }
        if (evt.type === "run_end") {
            this._onState({ stdinRequest: null, stepByStep: { active: false }, chat: { active: false } });
            this._unsubscribe?.();
            this._unsubscribe = null;
        }
    };

    private chatHandlers(): WaldiezChatHandlers {
        return {
            onUserInput: (input: WaldiezChatUserInput) => {
                const text = typeof input === "string" ? input : JSON.stringify(input);
                this.getCtrl()?.stdin(text);
                this._onState({ stdinRequest: null, chat: { activeRequest: undefined } });
            },
            onInterrupt: () => this.getCtrl()?.interrupt(),
            onClose: () => this.closeChat(),
        };
    }

    private stepHandlers(): WaldiezStepHandlers {
        return {
            sendControl: payload => {
                // console.debug("control payload:", payload);
                const response = { ...(payload as any) };
                if ((!response.request_id || response.request_id === "<unknown>") && this._currentRequestId) {
                    response.request_id = this._currentRequestId;
                }
                this.getCtrl()?.send({
                    op: "waldiez_control",
                    payload: { ...response, type: "debug_input_response" },
                });
            },
            respond: payload =>
                this.getCtrl()?.send({
                    op: "waldiez_respond",
                    payload: { ...(payload as any), type: "input_response" },
                }),
            close: () => this.closeStep(),
        };
    }

    private _handleStdout(chunk: string) {
        for (const obj of extractJsonObjects(chunk)) {
            if (this._mode === "step") {
                const step: WaldiezStepByStepProcessingResult | undefined =
                    WaldiezStepByStepProcessor.process(obj);
                if (step && !step.error) {
                    this._applyStep(step);
                    continue;
                }
                const chat: WaldiezChatMessageProcessingResult | undefined =
                    WaldiezChatMessageProcessor.process(obj);
                if (chat) {
                    this._applyStepFromChat(chat);
                    continue;
                }
            } else {
                const chat: WaldiezChatMessageProcessingResult | undefined =
                    WaldiezChatMessageProcessor.process(obj);
                if (chat) {
                    this._applyChat(chat);
                    continue;
                }
            }

            // generic input request fallback
            if (obj?.type === "input_request") {
                this._onState({
                    stdinRequest: {
                        prompt: String(obj.prompt ?? ""),
                        password: !!obj.password,
                    },
                });
            }
            if (obj?.type === "debug_input_request") {
                this._onState({
                    stdinRequest: {
                        prompt: String(obj.prompt ?? ""),
                        password: !!obj.password,
                    },
                });
            }
        }
    }
    private _applyChat(res: WaldiezChatMessageProcessingResult) {
        // console.debug("chat update:", res);
        const patch: Partial<WaldiezState> = { chat: {} as any };
        if (res.message?.type === "input_request") {
            patch.chat!.activeRequest = {
                request_id: res.requestId || res.message.request_id || "<unknown>",
                prompt: res.message.prompt || res.message.content.toString(),
                password: res.message?.password || false,
            };
        } else {
            patch.chat!.activeRequest = undefined;
        }
        if (res.message) {
            patch.chat!.messages = [res.message];
        }
        if (res.timeline !== undefined) {
            patch.chat!.timeline = res.timeline;
        }
        if (res.participants) {
            patch.chat!.userParticipants = res.participants;
        }
        this._onState(patch);
    }

    private _applyStep(res: WaldiezStepByStepProcessingResult) {
        const patch: Partial<WaldiezState> = { stepByStep: {} as any };
        if (!res.stateUpdate) {
            return;
        }
        const stateUpdate = res.stateUpdate;
        if (stateUpdate.currentEvent !== undefined) {
            patch.stepByStep!.currentEvent = stateUpdate.currentEvent;
        }
        if (stateUpdate.eventHistory) {
            patch.stepByStep!.eventHistory = stateUpdate.eventHistory;
        }
        if (stateUpdate.participants) {
            patch.stepByStep!.participants = stateUpdate.participants;
        }
        if (stateUpdate.help !== undefined) {
            patch.stepByStep!.help = stateUpdate?.help;
        }
        if (stateUpdate.lastError !== undefined) {
            patch.stepByStep!.lastError = stateUpdate.lastError;
        }
        if (stateUpdate.pendingControlInput !== undefined) {
            patch.stepByStep!.pendingControlInput = stateUpdate.pendingControlInput;
            this._currentRequestId = stateUpdate.pendingControlInput?.request_id;
        } else {
            patch.stepByStep!.pendingControlInput = undefined;
        }
        if (stateUpdate.activeRequest !== undefined) {
            patch.stepByStep!.activeRequest = stateUpdate.activeRequest;
            this._currentRequestId = stateUpdate.activeRequest?.request_id;
        } else {
            patch.stepByStep!.activeRequest = undefined;
        }
        if (stateUpdate.stepMode !== undefined) {
            patch.stepByStep!.stepMode = stateUpdate.stepMode;
        }
        if (stateUpdate.autoContinue !== undefined) {
            patch.stepByStep!.autoContinue = stateUpdate.autoContinue;
        }
        if (stateUpdate.breakpoints) {
            patch.stepByStep!.breakpoints = stateUpdate.breakpoints;
        }
        if (stateUpdate.timeline !== undefined) {
            patch.stepByStep!.timeline = stateUpdate.timeline;
        }

        this._onState(patch);
    }
    private _applyStepFromChat(res: WaldiezChatMessageProcessingResult) {
        if (res.participants) {
            this._onState({
                stepByStep: {
                    participants: res.participants,
                },
            });
            return;
        }
        if (res.timeline) {
            this._onState({
                stepByStep: {
                    timeline: res.timeline,
                },
            });
        }
    }
}
/** Simple JSON object extractor (same as before, trimmed) */
function extractJsonObjects(text: string): any[] {
    const results: any[] = [];
    for (const line of text.split(/\r?\n/)) {
        const s = line.trim();
        if (!s) {
            continue;
        }
        try {
            results.push(JSON.parse(s));
            continue;
        } catch {
            /* try brace scan */
        }
        for (const candidate of scanBraceObjects(s)) {
            try {
                results.push(JSON.parse(candidate));
            } catch {
                /* ignore */
            }
        }
    }
    return results;
}

function scanBraceObjects(s: string): string[] {
    const out: string[] = [];
    let depth = 0,
        start = -1,
        inStr: false | '"' | "'" | "`" = false,
        esc = false;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (inStr) {
            if (esc) {
                esc = false;
            } else if (ch === "\\") {
                esc = true;
            } else if (ch === inStr) {
                inStr = false;
            }
            continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
            inStr = ch as any;
            continue;
        }
        if (ch === "{") {
            if (depth === 0) {
                start = i;
            }
            depth++;
        } else if (ch === "}") {
            depth--;
            if (depth === 0 && start >= 0) {
                out.push(s.slice(start, i + 1));
                start = -1;
            }
        }
    }
    return out;
}
