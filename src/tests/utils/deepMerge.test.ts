/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import { DEL, type DeepMergeOptions, deepMerge } from "@/utils/deepMerge";
import { describe, expect, it } from "vitest";

describe("deepMerge", () => {
    describe("basic object merging", () => {
        it("should merge simple objects", () => {
            const base = { a: 1, b: 2, c: 3 };
            const patch = { b: 4, c: 5 };

            const result = deepMerge(base, patch);

            expect(result).toEqual({ a: 1, b: 4, c: 5 });
            expect(result).not.toBe(base);
        });

        it("should merge nested objects", () => {
            const base = {
                a: { x: 1, y: 2, z: 3 },
                b: 3,
                c: { nested: "value" },
            };
            const patch = {
                a: { y: 4, z: 5 },
                c: { nested: "updated" },
            } as any;

            const result = deepMerge(base, patch);

            expect(result).toEqual({
                a: { x: 1, y: 4, z: 5 },
                b: 3,
                c: { nested: "updated" },
            });
        });

        it("should handle deeply nested objects", () => {
            const base = {
                level1: {
                    level2: {
                        level3: {
                            value: "original",
                            keep: true,
                            extra: "data",
                        },
                    },
                    otherProp: "unchanged",
                },
                topLevel: "preserved",
            };

            const patch = {
                level1: {
                    level2: {
                        level3: {
                            value: "updated",
                            newProp: "added",
                        },
                    },
                },
            } as any;

            const result = deepMerge(base, patch);

            expect(result).toEqual({
                level1: {
                    level2: {
                        level3: {
                            value: "updated",
                            keep: true,
                            extra: "data",
                            newProp: "added",
                        },
                    },
                    otherProp: "unchanged",
                },
                topLevel: "preserved",
            });
        });
    });

    describe("array handling", () => {
        it("should replace arrays by default", () => {
            const base = { arr: [1, 2, 3], other: "preserved" };
            const patch = { arr: [4, 5] };

            const result = deepMerge(base, patch);

            expect(result).toEqual({ arr: [4, 5], other: "preserved" });
        });

        it("should handle empty arrays", () => {
            const base = { arr: [1, 2, 3], other: "data" };
            const patch = { arr: [] };

            const result = deepMerge(base, patch);

            expect(result).toEqual({ arr: [], other: "data" });
        });

        it("should use configured array strategies", () => {
            const base = { messages: [1, 2], status: "active" };
            const patch = { messages: [3, 4] };

            const options: DeepMergeOptions = {
                arrayStrategies: {
                    messages: "append",
                },
            };

            const result = deepMerge(base, patch, options);

            expect(result).toEqual({ messages: [1, 2, 3, 4], status: "active" });
        });

        it("should use prepend strategy", () => {
            const base = {
                events: [{ id: 1 }, { id: 2 }],
                config: { enabled: true },
            };
            const patch = {
                events: [{ id: 3 }, { id: 4 }],
            };

            const options: DeepMergeOptions = {
                arrayStrategies: {
                    events: "prepend",
                },
            };

            const result = deepMerge(base, patch, options);

            expect(result).toEqual({
                events: [{ id: 3 }, { id: 4 }, { id: 1 }, { id: 2 }],
                config: { enabled: true },
            });
        });

        it("should handle default array configurations for chat messages", () => {
            const base = {
                chat: {
                    messages: [{ id: 1 }, { id: 2 }],
                    active: true,
                },
                user: "john",
            };
            const patch = {
                chat: {
                    messages: [{ id: 3 }, { id: 2 }], // id: 2 is duplicate
                },
            } as any;

            const result = deepMerge(base, patch);

            expect(result.chat.messages).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
            expect(result.chat.active).toBe(true);
            expect(result.user).toBe("john");
        });
    });

    describe("special values", () => {
        it("should handle undefined patch", () => {
            const base = { a: 1, b: 2 };
            const result = deepMerge(base, undefined);

            expect(result).toBe(base); // Should return same reference
        });

        it("should handle explicit undefined values", () => {
            const base = { a: 1, b: 2, c: 3 };
            const patch = { b: undefined };

            const result = deepMerge(base, patch);

            expect(result).toEqual({ a: 1, b: undefined, c: 3 });
        });

        it("should handle null values", () => {
            const base = { a: 1, b: 2, c: "test" };
            const patch = { b: null, c: null } as any;

            const result = deepMerge(base, patch);

            expect(result).toEqual({ a: 1, b: null, c: null });
        });

        it("should handle DEL symbol for deletion", () => {
            const base = { a: 1, b: 2, c: 3 };
            const patch = { b: DEL } as any;

            const result = deepMerge(base, patch);

            expect(result).toEqual({ a: 1, c: 3 });
            expect(result).not.toHaveProperty("b");
        });

        // it("should handle deleteKeys option", () => {
        //     const base = { a: 1, b: 2, c: 3 };
        //     const patch = { a: 2 }; // Empty partial
        //     const options: DeepMergeOptions = {
        //         deleteKeys: ["b", "c"],
        //     };

        //     const result = deepMerge(base, patch, options);

        //     expect(result).toEqual({ a: 2 });
        // });
    });

    describe("primitive values", () => {
        it("should replace primitive values", () => {
            const base = { a: "old", b: 123, c: true };
            const patch = { a: "new", b: 456, c: false };

            const result = deepMerge(base, patch);

            expect(result).toEqual({ a: "new", b: 456, c: false });
        });

        it("should handle mixed primitive and object values", () => {
            const base = {
                a: { nested: "value", other: "data" },
                b: "string",
                c: 42,
            };
            const patch = {
                a: { nested: "updated" },
                b: "updated string",
            } as any;

            const result = deepMerge(base, patch);

            expect(result).toEqual({
                a: { nested: "updated", other: "data" },
                b: "updated string",
                c: 42,
            });
        });
    });

    describe("reference preservation", () => {
        it("should preserve references when possible", () => {
            const base = { a: 1, nested: { x: 1, y: 2 }, other: "data" };
            const patch = { a: 2 }; // doesn't touch nested

            const result = deepMerge(base, patch);

            // nested object should be preserved if unchanged
            expect(result.nested).toBe(base.nested);
            expect(result).toEqual({ a: 2, nested: { x: 1, y: 2 }, other: "data" });
        });

        it("should return same reference for identical inputs", () => {
            const obj = { a: 1, b: 2 };
            const result = deepMerge(obj, obj);

            expect(result).toBe(obj);
        });

        it("should return base for empty patch", () => {
            const base = { a: 1, b: 2 };
            const patch = {}; // Empty partial

            const result = deepMerge(base, patch);

            expect(result).toBe(base);
        });
    });

    describe("error handling", () => {
        it("should throw error for null base", () => {
            expect(() => deepMerge(null as any, { a: 1 })).toThrow("Base object cannot be null or undefined");
        });

        it("should throw error for undefined base", () => {
            expect(() => deepMerge(undefined as any, { a: 1 })).toThrow(
                "Base object cannot be null or undefined",
            );
        });

        it("should throw error for null patch", () => {
            expect(() => deepMerge({ a: 1 }, null as any)).toThrow("Patch object cannot be null");
        });

        it("should throw error for excessive recursion", () => {
            // Create a circular-like deep structure
            const createDeepObject = (depth: number): any => {
                if (depth === 0) {
                    return { value: "deep" };
                }
                return { nested: createDeepObject(depth - 1) };
            };

            const base = createDeepObject(60); // Exceed default maxDepth of 50
            const patch = createDeepObject(60);

            expect(() => deepMerge(base, patch)).toThrow("Maximum recursion depth");
        });

        it("should respect custom maxDepth", () => {
            const base = { a: { b: { c: "value" } } };
            const patch = { a: { b: { c: "new" } } };

            const options: DeepMergeOptions = { maxDepth: 1 };

            expect(() => deepMerge(base, patch, options)).toThrow("Maximum recursion depth (1) exceeded");
        });
    });

    describe("typed partial behavior", () => {
        it("should handle strongly typed partial objects", () => {
            interface IUser {
                id: number;
                name: string;
                email: string;
                settings: {
                    theme: string;
                    notifications: boolean;
                };
            }

            const base: IUser = {
                id: 1,
                name: "John",
                email: "john@old.com",
                settings: { theme: "dark", notifications: true },
            };

            const patch: Partial<IUser> = {
                email: "john@new.com",
                settings: { theme: "light", notifications: true },
            };

            const result = deepMerge(base, patch);

            expect(result).toEqual({
                id: 1,
                name: "John",
                email: "john@new.com",
                settings: { theme: "light", notifications: true },
            });
        });

        it("should handle nested partial objects", () => {
            interface IConfig {
                api: {
                    url: string;
                    timeout: number;
                    retries: number;
                };
                ui: {
                    theme: string;
                    language: string;
                };
            }

            const base: IConfig = {
                api: { url: "https://api.old.com", timeout: 5000, retries: 3 },
                ui: { theme: "dark", language: "en" },
            };

            const patch = {
                api: { timeout: 10000 }, // Partial of api object
                ui: { theme: "light" }, // Partial of ui object
            } as any;

            const result = deepMerge(base, patch);

            expect(result).toEqual({
                api: { url: "https://api.old.com", timeout: 10000, retries: 3 },
                ui: { theme: "light", language: "en" },
            });
        });
    });

    describe("real-world scenarios", () => {
        it("should handle chat state updates", () => {
            interface IChatState {
                active: boolean;
                messages: Array<{ id: number; text: string; timestamp: number }>;
                user: { name: string; status: string };
                settings: { sound: boolean; notifications: boolean };
            }

            const base: IChatState = {
                active: true,
                messages: [
                    { id: 1, text: "Hello", timestamp: 1000 },
                    { id: 2, text: "World", timestamp: 2000 },
                ],
                user: { name: "John", status: "online" },
                settings: { sound: true, notifications: true },
            };

            const patch = {
                messages: [
                    { id: 3, text: "New message", timestamp: 3000 },
                    { id: 2, text: "World", timestamp: 2000 }, // Duplicate
                ],
                settings: { sound: false }, // Partial settings update
            } as any;

            const result = deepMerge(base, patch);

            expect(result).toEqual({
                active: true,
                messages: [
                    { id: 3, text: "New message", timestamp: 3000 },
                    { id: 2, text: "World", timestamp: 2000 },
                ],
                user: { name: "John", status: "online" },
                settings: { sound: false, notifications: true }, // Merged settings
            });
        });

        it("should handle step-by-step execution state", () => {
            interface IExecutionState {
                stepByStep: {
                    eventHistory: Array<{ id: number; event: string; timestamp: number }>;
                    currentStep: number;
                    paused: boolean;
                };
                results: string[];
            }

            const base: IExecutionState = {
                stepByStep: {
                    eventHistory: [
                        { id: 1, event: "start", timestamp: 1000 },
                        { id: 2, event: "step1", timestamp: 2000 },
                    ],
                    currentStep: 1,
                    paused: false,
                },
                results: ["result1"],
            };

            const patch: Partial<IExecutionState> = {
                stepByStep: {
                    eventHistory: [{ id: 3, event: "step2", timestamp: 3000 }],
                    currentStep: 2,
                    paused: false,
                },
            };

            const result = deepMerge(base, patch);

            // stepByStep.eventHistory uses prepend strategy by default
            expect(result.stepByStep.eventHistory).toEqual([
                { id: 3, event: "step2", timestamp: 3000 },
                { id: 1, event: "start", timestamp: 1000 },
                { id: 2, event: "step1", timestamp: 2000 },
            ]);
            expect(result.stepByStep.currentStep).toBe(2);
            expect(result.stepByStep.paused).toBe(false); // Preserved
            expect(result.results).toEqual(["result1"]); // Preserved
        });
    });

    describe("edge cases", () => {
        it("should handle empty objects", () => {
            const result1 = deepMerge({}, { a: 1 } as any);
            expect(result1).toEqual({ a: 1 });

            const result2 = deepMerge({ a: 1 }, {});
            expect(result2).toEqual({ a: 1 });
        });

        it("should handle nested undefined in partial", () => {
            const base = {
                config: {
                    setting1: "value1",
                    setting2: "value2",
                    setting3: "value3",
                },
            };
            const patch = {
                config: {
                    setting2: undefined, // Explicitly undefined in partial
                },
            } as any;

            const result = deepMerge(base, patch);

            expect(result).toEqual({
                config: {
                    setting1: "value1",
                    setting2: undefined, // Explicitly set to undefined
                    setting3: "value3",
                },
            });
        });

        it("should handle arrays in partial updates", () => {
            const base = {
                items: [1, 2, 3],
                metadata: { count: 3, updated: false },
            };
            const patch = {
                items: [4, 5], // Replace entire array
            };

            const result = deepMerge(base, patch);

            expect(result).toEqual({
                items: [4, 5],
                metadata: { count: 3, updated: false },
            });
        });
    });
});
