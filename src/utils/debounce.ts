/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import { useCallback, useEffect, useRef } from "react";

/**
 * Debounce a callback function inside React.
 *
 * @param fn - The function to debounce
 * @param delay - Delay in ms
 */
export function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number) {
    const fnRef = useRef(fn);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // always keep latest fn
    useEffect(() => {
        fnRef.current = fn;
    }, [fn]);

    // stable debounced function
    const debounced = useCallback(
        (...args: Parameters<T>) => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(() => {
                fnRef.current(...args);
            }, delay);
        },
        [delay],
    );

    // optional: cancel on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    return debounced;
}
