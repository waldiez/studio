/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import axiosInstance from "@/lib/axiosInstance";
import { emitWorkspaceChanged } from "@/lib/events";
import { useWorkspace } from "@/store/workspace";
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
    const { setFileCache } = useWorkspace();

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
            const nameParts = path.split("/");
            const name = nameParts[nameParts.length - 1];
            setFileCache({ item: { type: "file", path, name }, mime: "", content: contents });
        },
        [setFileCache, path],
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
        async (
            contents?: string,
            breakpoints?: (string | WaldiezBreakpoint)[] | undefined,
            checkpoint?: string | null,
        ) => {
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
            if (checkpoint) {
                args.push("--checkpoint", checkpoint);
            }
            if (args.length > 0) {
                ctrl.start(path, { mode: "step" satisfies WaldiezMode, args });
            } else {
                ctrl.start(path, { mode: "step" satisfies WaldiezMode });
            }
        },
        [ctrl, path, save],
    );
    const getCheckpoints: () => Promise<Record<string, any> | null> = useCallback(async () => {
        if (!path) {
            return null;
        }
        try {
            const response = await axiosInstance.get("/flow/checkpoints", {
                params: { path },
            });
            return response.data;
        } catch (error) {
            console.debug(error);
            return null;
        }
    }, [path]);
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

    return { state, controller: ctrl, actions: { run, stepRun, save, convert, getCheckpoints } };
}
