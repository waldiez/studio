/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */

/**
 * Utility function to hash a path string.
 * The hash is a simple 32-bit integer representation of the path.
 *
 * @param path - The path to hash.
 * @returns - A string representation of the hashed path.
 */
export const hashPath = (path: string): string => {
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
        const char = path.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32-bit integer
    }
    return `wf-${Math.abs(hash)}`;
};
