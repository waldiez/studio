/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
/* eslint-disable tsdoc/syntax */
type PlainObject = Record<string, any>;

export const DEL = Symbol("deepMerge.delete");

export type DeepMergeOptions = {
    /** Maximum recursion depth to prevent stack overflow */
    maxDepth?: number;
    /** Keys to delete from the result */
    deleteKeys?: string[];
    /** Custom array merge strategies by path */
    arrayStrategies?: Record<string, ArrayMergeStrategy>;
};

export type ArrayMergeStrategy = "replace" | "append" | "prepend";

type ArrayConfig = {
    strategy: ArrayMergeStrategy;
    cap?: number;
    dedupe?: boolean;
};

const DEFAULT_ARRAY_CONFIGS: Record<string, ArrayConfig> = {
    "chat.messages": { strategy: "append", cap: 2000, dedupe: true },
    "stepByStep.eventHistory": { strategy: "prepend", cap: 5000, dedupe: true },
};

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const DEFAULT_MAX_DEPTH = 50;

class DeepMergeError extends Error {
    constructor(
        message: string,
        public readonly path: string[],
    ) {
        super(`${message} at path: ${path.join(".")}`);
        this.name = "DeepMergeError";
    }
}

function isPlainObject(val: any): val is PlainObject {
    return val !== null && typeof val === "object" && Object.getPrototypeOf(val) === Object.prototype;
}

function isMergeableObject(val: any): val is PlainObject {
    return isPlainObject(val);
}

function isEmptyObject(obj: any): boolean {
    if (!isPlainObject(obj)) {
        return false;
    }
    return Object.keys(obj).length === 0;
}

function validateInputs(base: any, patch: any): void {
    if (base === null || base === undefined) {
        throw new DeepMergeError("Base object cannot be null or undefined", []);
    }
    if (patch === null) {
        throw new DeepMergeError("Patch object cannot be null", []);
    }
}

function dedupeById<T extends { id?: string | number }>(arr: T[]): T[] {
    const seen = new Set<string | number>();
    const result: T[] = [];

    for (const item of arr) {
        if (item && typeof item === "object" && "id" in item) {
            const id = item.id;
            if (id !== undefined && id !== null) {
                if (!seen.has(id)) {
                    seen.add(id);
                    result.push(item);
                }
                continue;
            }
        }
        // No id or invalid id, keep as-is
        result.push(item);
    }

    return result;
}

function mergeArrays(base: any, patch: any, path: string[], options: DeepMergeOptions): any[] {
    const baseArr = Array.isArray(base) ? base : [];
    const patchArr = Array.isArray(patch) ? patch : [patch];

    const pathStr = path.join(".");

    if (Array.isArray(patch) && patch.length === 0) {
        return [];
    }
    const config = DEFAULT_ARRAY_CONFIGS[pathStr] || { strategy: "replace" };

    // Allow options to override default strategies
    if (options.arrayStrategies?.[pathStr]) {
        config.strategy = options.arrayStrategies[pathStr];
    }

    let result: any[];

    switch (config.strategy) {
        case "append":
            result = baseArr.length ? [...baseArr, ...patchArr] : [...patchArr];
            break;
        case "prepend":
            result = [...patchArr, ...baseArr];
            break;
        case "replace":
        default:
            result = [...patchArr];
            break;
    }

    // Apply deduplication if configured
    if (config.dedupe && result.length > 0) {
        result = dedupeById(result);
    }

    // Apply cap if configured
    if (config.cap && result.length > config.cap) {
        result = result.slice(result.length - config.cap);
    }

    return result;
}

// eslint-disable-next-line max-statements
function mergeObjects(
    base: PlainObject,
    patch: PlainObject,
    path: string[],
    options: DeepMergeOptions,
    depth: number,
): PlainObject {
    const result: PlainObject = { ...base };

    for (const key of Object.keys(patch)) {
        if (FORBIDDEN_KEYS.has(key)) {
            continue;
        }

        const currentPath = [...path, key];
        const patchValue = patch[key];

        if (patchValue === undefined) {
            result[key] = undefined;
            continue;
        }

        if (patchValue === DEL || options.deleteKeys?.includes(key)) {
            delete result[key];
            continue;
        }

        const baseValue = base[key];
        const merged = deepMergeRecursive(baseValue, patchValue, currentPath, options, depth + 1);

        // Preserve reference if values are identical
        result[key] = Object.is(merged, baseValue) ? baseValue : merged;
    }

    return result;
}

function arrayShallowEqual(a: any[], b: any[]): boolean {
    if (a === b) {
        return true;
    }
    if (!Array.isArray(a) || !Array.isArray(b)) {
        return false;
    }
    if (a.length !== b.length) {
        return false;
    }

    return a.every((item, index) => Object.is(item, b[index]));
}

function deepMergeRecursive(
    base: any,
    patch: any,
    path: string[],
    options: DeepMergeOptions,
    depth: number,
): any {
    const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

    if (depth > maxDepth) {
        throw new DeepMergeError(`Maximum recursion depth (${maxDepth}) exceeded`, path);
    }

    // Handle deletion
    if (patch === DEL) {
        return undefined;
    }

    // Skip undefined patches
    if (patch === undefined) {
        return base;
    }

    // Handle arrays
    if (Array.isArray(base) || Array.isArray(patch)) {
        const merged = mergeArrays(base, patch, path, options);
        return Array.isArray(base) && arrayShallowEqual(merged, base) ? base : merged;
    }

    // Handle non-mergeable objects (primitives, dates, etc.)
    if (!isMergeableObject(base) || !isMergeableObject(patch)) {
        return Object.is(base, patch) ? base : patch;
    }

    // Handle plain objects
    return mergeObjects(base, patch, path, options, depth);
}

/**
 * Deep-merge `patch` into `base`, producing a new object.
 *
 * @param base - The base object to merge into
 * @param patch - The patch object to merge from
 * @param options - Configuration options for the merge behavior
 * @returns A new merged object
 *
 * @throws {DeepMergeError} When inputs are invalid or recursion limit is exceeded
 */
export function deepMerge<T extends object>(
    base: T,
    patch: Partial<T> | undefined,
    options: DeepMergeOptions = {},
): T {
    // Handle undefined patch
    if (patch === undefined) {
        return base;
    }

    // Handle same reference
    if (base === patch) {
        return base;
    }

    // Validate inputs
    validateInputs(base, patch);

    // Handle empty patch
    if (isEmptyObject(patch)) {
        return base;
    }

    try {
        return deepMergeRecursive(base, patch, [], options, 0) as T;
    } catch (error) {
        if (error instanceof DeepMergeError) {
            throw error;
        }
        throw new DeepMergeError(`Unexpected error during merge: ${error}`, []);
    }
}
