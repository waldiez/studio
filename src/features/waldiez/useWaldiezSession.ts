/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import axiosInstance from "@/lib/axiosInstance";
import { emitWorkspaceChanged } from "@/lib/events";
import { dirname } from "@/utils/paths";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { WaldiezBreakpoint, WaldiezChatMessage } from "@waldiez/react";

import { WaldiezController } from "./controller";
import type { WaldiezMode, WaldiezState } from "./types";

const waldiezBreakpointToString: (breakpoint: WaldiezBreakpoint | string) => string = bp => {
    if (typeof bp === "string") {
        return bp;
    }
    let bp_string = "";
    if (bp.type === "event" && bp.event_type) {
        bp_string += `${bp.type}:${bp.event_type}`;
    } else if (bp.type === "agent" && bp.agent) {
        bp_string += `${bp.type}:${bp.agent}`;
    } else if (bp.type === "agent_event") {
        //
    }
    return bp_string;
};
const initial: WaldiezState = {
    chat: {
        show: false,
        active: false,
        messages: [],
        userParticipants: [],
        handlers: {} as any,
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
        handlers: {} as any,
    },
    stdinRequest: null,
};

type PlainObject = Record<string, unknown>;
function getItemKey(m: PlainObject): string {
    return (
        m.id ??
        m.timestamp ??
        m.uuid ??
        (m.content && (m.content as any).uuid) ??
        m.key ??
        `${m.role ?? m.name ?? "?"}|${JSON.stringify(m.content)}|${m.createdAt ?? m.ts ?? ""}`
    ).toString();
}

function dedupeById<T extends PlainObject>(arr: T[], keyFn: (item: T) => string): T[] {
    const seen = new Set<string>();
    const result: T[] = [];

    for (const item of arr) {
        const key =
            item.id ??
            item.uuid ??
            item.timestamp ??
            (item.content && (item.content as any).uuid) ??
            keyFn(item);
        if (!key) {
            continue;
        }
        const keyStr = String(key);
        if (!seen.has(keyStr)) {
            seen.add(keyStr);
            result.push(item);
        }
    }

    return result;
}
function mergeMessages(
    existing: PlainObject[] | undefined,
    incoming: PlainObject[] | undefined,
): PlainObject[] {
    const base = existing ?? [];
    const add = incoming ?? [];
    if (add.length === 0) {
        return base;
    }
    const merged = [...base, ...add];
    return dedupeById(merged, getItemKey);
}

function mergeEventHistory(
    existing: PlainObject[] | undefined,
    incoming: PlainObject[] | undefined,
): PlainObject[] {
    const base = existing ?? [];
    const add = incoming ?? [];
    if (add.length === 0) {
        return base;
    }
    const merged = [...add, ...base];
    return dedupeById(merged, getItemKey);
}
function mergeWaldiezState(prev: WaldiezState, patch: Partial<WaldiezState>): WaldiezState {
    let next: WaldiezState = { ...prev, ...patch };

    if (patch.chat) {
        const prevChat = prev.chat ?? {};
        const patchChat = patch.chat;

        const mergedMessages =
            "messages" in patchChat
                ? (mergeMessages(
                      prevChat.messages as PlainObject[],
                      patchChat.messages as PlainObject[],
                  ) as unknown as WaldiezChatMessage[])
                : prevChat.messages;

        next = {
            ...next,
            chat: {
                ...prevChat,
                ...patchChat,
                ...(mergedMessages ? { messages: mergedMessages } : {}),
            },
        };
    }
    if (patch.stepByStep) {
        const prevStep = prev.stepByStep ?? {};
        const patchStep = patch.stepByStep;

        let mergedEvents =
            "eventHistory" in patchStep
                ? mergeEventHistory(
                      prevStep.eventHistory as PlainObject[],
                      patchStep.eventHistory as PlainObject[],
                  )
                : (prevStep.eventHistory as PlainObject[]);

        const currentEvent = "currentEvent" in patchStep ? patchStep.currentEvent : prevStep.currentEvent;

        // If we have a currentEvent, ensure it’s also in eventHistory
        if (currentEvent && typeof currentEvent === "object") {
            mergedEvents = mergeEventHistory(mergedEvents, [currentEvent as PlainObject]);
        }

        next = {
            ...next,
            stepByStep: {
                ...prevStep,
                ...patchStep,
                ...(mergedEvents ? { eventHistory: mergedEvents } : {}),
                ...(currentEvent ? { currentEvent } : {}),
            },
        };
    }

    return next;
}
export function useWaldiezSession(path: string | null) {
    const [state, setState] = useState<WaldiezState>(initial);

    const ctrl = useMemo(
        () =>
            new WaldiezController(patch => {
                setState(prev => {
                    //
                    const newState = mergeWaldiezState(prev, patch);
                    return newState;
                });
            }),
        [],
    );

    useEffect(() => {
        ctrl.stop();
        return () => ctrl.stop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path]);

    const save = useCallback(
        async (contents: string) => {
            if (!path) {
                return;
            }
            await axiosInstance.post(
                "/flow",
                {
                    contents,
                },
                {
                    params: { path },
                },
            );
        },
        [path],
    );

    const run = useCallback(
        async (contents?: string) => {
            if (!path) {
                return;
            }
            if (contents) {
                await save(contents);
            }
            ctrl.start(path, { mode: "chat" satisfies WaldiezMode });
        },
        [ctrl, path, save],
    );

    const stepRun = useCallback(
        async (contents?: string, breakpoints?: (string | WaldiezBreakpoint)[] | undefined) => {
            if (!path) {
                return;
            }
            if (contents) {
                await save(contents);
            }
            const bpArgs = breakpoints ? breakpoints.map(waldiezBreakpointToString) : undefined;
            const args: string[] = [];
            if (bpArgs) {
                for (const arg of bpArgs) {
                    args.push("--breakpoints", arg);
                }
            }
            ctrl.start(path, { mode: "step" satisfies WaldiezMode, args });
        },
        [ctrl, path, save],
    );
    const convert = useCallback(
        async (flow: string, to: "py" | "ipynb") => {
            if (!path) {
                return;
            }
            await save(flow);
            await axiosInstance.post("/flow/export", null, {
                params: {
                    path,
                    extension: to,
                },
            });
            emitWorkspaceChanged({ parent: `/${dirname(path)}` });
        },
        [path, save],
    );

    return { state, controller: ctrl, actions: { run, stepRun, save, convert } };
}
