/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
/* eslint-disable max-statements */
import { useExec } from "@/store/exec";

import { useCallback, useEffect, useRef } from "react";

export type AutoSaveOptions = {
    /** Interval in milliseconds between auto-save attempts (default: 30000 = 30s) */
    intervalMs?: number;
    /** Whether auto-save is enabled (default: true) */
    enabled?: boolean;
};

const DEFAULT_INTERVAL_MS = 30000; // 30 seconds

/**
 * Hook that provides auto-save functionality with awareness of execution state.
 * Will not trigger saves while a flow is running (either standard or step-by-step mode).
 *
 * @param path - The file path (null to disable auto-save)
 * @param onSave - Function to call with contents when auto-save triggers
 * @param options - Configuration options for auto-save behavior
 * @returns An object with:
 *   - `setContents`: Call this to update the contents to be auto-saved
 *   - `triggerSave`: Manually trigger a save (respects running state)
 */
export function useAutoSave(
    path: string | null,
    onSave: (contents: string) => void | Promise<void>,
    options: AutoSaveOptions = {},
) {
    const { intervalMs = DEFAULT_INTERVAL_MS, enabled = true } = options;

    // Store the latest contents
    const contentsRef = useRef<string | null>(null);
    // Track last saved contents to avoid unnecessary saves
    const lastSavedRef = useRef<string | null>(null);
    // Track if a save is in progress to avoid overlapping saves
    const isSaving = useRef(false);
    // Track if component is mounted
    const isMounted = useRef(true);

    const setContents = useCallback((contents: string) => {
        contentsRef.current = contents;
    }, []);

    const doAutoSave = useCallback(async () => {
        if (!path) {
            return;
        }

        // Check if running - skip auto-save during execution
        const { running } = useExec.getState();
        if (running) {
            return;
        }

        // Skip if already saving
        if (isSaving.current) {
            return;
        }

        // Get current contents
        const contents = contentsRef.current;
        if (!contents) {
            return;
        }

        // Skip if contents haven't changed since last save
        if (contents === lastSavedRef.current) {
            return;
        }

        try {
            isSaving.current = true;
            await onSave(contents);
            lastSavedRef.current = contents;
        } catch (error) {
            // Log but don't throw - auto-save failures shouldn't break the app
            console.debug("[auto-save] Save failed:", error);
        } finally {
            if (isMounted.current) {
                isSaving.current = false;
            }
        }
    }, [path, onSave]);

    useEffect(() => {
        isMounted.current = true;
        // Reset last saved when path changes
        lastSavedRef.current = null;

        if (!enabled || !path || intervalMs <= 0) {
            return;
        }

        const intervalId = setInterval(doAutoSave, intervalMs);

        return () => {
            isMounted.current = false;
            clearInterval(intervalId);
        };
    }, [enabled, path, intervalMs, doAutoSave]);

    return { setContents, triggerSave: doAutoSave };
}
