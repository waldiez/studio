/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import type { WaldiezMode } from "@/features/waldiez/types";
import { useWaldiezSession } from "@/features/waldiez/useWaldiezSession";
import { type RunRequest, onRunRequested, onRunStopRequested } from "@/lib/events";
import { useWorkspace } from "@/store/workspace";
import { extOf } from "@/utils/paths";

import { useEffect, useMemo } from "react";

import Waldiez, { importFlow } from "@waldiez/react";

type Props = { source: string };

// eslint-disable-next-line complexity
export default function WaldiezViewer({ source }: Props) {
    // const sel = useWorkspace(s => s.selected);
    const activeTab = useWorkspace(s => s.getActiveTab());
    const path = activeTab?.item.path ?? null;
    const flowProps = useMemo(() => importFlow(source), [source]);

    const { state, actions } = useWaldiezSession(path);

    useEffect(() => {
        if (!path || extOf(path) !== ".waldiez") {
            return;
        }

        const offRun = onRunRequested((detail: RunRequest) => {
            if (detail.path !== path && `/${detail.path}` !== path) {
                return;
            }
            const mode: WaldiezMode = detail.mode ?? "chat";
            if (mode === "step") {
                actions.stepRun();
            } else {
                actions.run();
            }
        });

        const offStop = onRunStopRequested(() => {
            // useExec.stop() is already called by GlobalRunListener.
            // we only need to close our UI state if desired.
            // The controller will observe run_end and tidy state
            // no extra work needed here.
        });

        return () => {
            offRun();
            offStop();
        };
    }, [path, actions]);

    const chatHandlers = state.chat?.handlers;
    const stepHandlers = state.stepByStep?.handlers;
    return (
        <div className="relative flex-1 w-full h-full">
            <Waldiez
                {...flowProps}
                onRun={actions.run}
                onStepRun={actions.stepRun}
                onConvert={actions.convert}
                onSave={actions.save}
                monacoVsPath="vs"
                chat={{
                    show: state.chat?.show ?? false,
                    active: state.chat.active ?? false,
                    messages: state.chat?.messages ?? [],
                    timeline: state.chat?.timeline,
                    activeRequest: state.chat?.activeRequest,
                    userParticipants: state.chat?.userParticipants ?? [],
                    error: state.chat.error,
                    handlers: chatHandlers,
                }}
                stepByStep={{
                    show: stepHandlers ? (state.stepByStep?.show ?? false) : false,
                    active: state.stepByStep?.active ?? false,
                    stepMode: state.stepByStep?.stepMode ?? true,
                    autoContinue: state.stepByStep?.autoContinue ?? false,
                    breakpoints: state.stepByStep?.breakpoints ?? [],
                    eventHistory: state.stepByStep?.eventHistory ?? [],
                    currentEvent: state.stepByStep?.currentEvent,
                    timeline: state.stepByStep?.timeline,
                    participants: state.stepByStep?.participants ?? [],
                    help: state.stepByStep?.help,
                    lastError: state.stepByStep?.lastError,
                    pendingControlInput: state.stepByStep?.pendingControlInput ?? null,
                    activeRequest: state.stepByStep?.activeRequest ?? null,
                    handlers: stepHandlers || {
                        close: () => {},
                        sendControl: () => {},
                        respond: () => {},
                    },
                }}
            />
        </div>
    );
}
