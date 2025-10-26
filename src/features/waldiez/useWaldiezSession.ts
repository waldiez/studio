/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import axiosInstance from "@/lib/axiosInstance";
import { emitWorkspaceChanged } from "@/lib/events";
import { deepMerge } from "@/utils/deepMerge";
import { dirname } from "@/utils/paths";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { WaldiezBreakpoint } from "@waldiez/react";

import { WaldiezController } from "./controller";
import type { WaldiezMode, WaldiezState } from "./types";

/* c8 ignore next -- @preserve */
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

export function useWaldiezSession(path: string | null) {
    const [state, setState] = useState<WaldiezState>(initial);

    const ctrl = useMemo(
        () =>
            new WaldiezController(patch => {
                setState(prev => {
                    //
                    const newState = deepMerge(prev, patch);
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

    /* c8 ignore next -- @preserve */
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
            if (args.length > 0) {
                ctrl.start(path, { mode: "step" satisfies WaldiezMode, args });
            } else {
                ctrl.start(path, { mode: "step" satisfies WaldiezMode });
            }
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
