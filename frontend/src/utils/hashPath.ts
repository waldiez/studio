/**
 * Hashes a path to a unique string.
 * @param path - The path to hash.
 * @returns The hashed path.
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
