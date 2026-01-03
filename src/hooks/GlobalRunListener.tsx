/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
// import { bus } from "@/lib/events";
import { type RunRequest, onRunRequested, onRunStopRequested } from "@/lib/events";
import { useExec } from "@/store/exec";
import { extOf, isRunnable, isWaldiez } from "@/utils/paths";

import { useEffect } from "react";

export default function GlobalRunListener() {
    useEffect(() => {
        const offRun = onRunRequested((detail: RunRequest) => {
            if (!isRunnable(detail.path)) {
                return;
            }

            if (isWaldiez(detail.path)) {
                // Handled by WaldiezViewer that owns this path.
                return;
            }

            // Generic runners
            const args =
                extOf(detail.path) === ".ipynb"
                    ? [] // (Notebook runner will use fresh kernel, other flags can be passed in opts)
                    : []; // .py: add module args if needed
            useExec.getState().run(detail.path, { args });
        });

        const offStop = onRunStopRequested(() => {
            useExec.getState().stop();
        });

        return () => {
            offRun();
            offStop();
        };
    }, []);

    return null;
}
