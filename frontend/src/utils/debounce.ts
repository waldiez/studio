/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
export const debounceSync = <T extends (...args: any[]) => void>(
    func: T,
    delay: number,
): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

export const debounce = <T extends (...args: any[]) => Promise<any>>(
    func: T,
    delay: number,
): ((...args: Parameters<T>) => Promise<ReturnType<T>>) => {
    let timeoutId: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>): Promise<ReturnType<T>> => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        return new Promise((resolve, reject) => {
            timeoutId = setTimeout(async () => {
                try {
                    const result = await func(...args);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }, delay);
        });
    };
};
