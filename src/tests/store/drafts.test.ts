/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
/* eslint-disable max-nested-callbacks */
import { useDrafts } from "@/store/drafts";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

describe("useDrafts store", () => {
    beforeEach(() => {
        // Clear the store state before each test
        const { result } = renderHook(() => useDrafts());
        act(() => {
            // Clear all existing drafts
            Object.keys(result.current.drafts).forEach(path => {
                result.current.clearDraft(path);
            });
        });
    });

    it("should initialize with empty drafts", () => {
        const { result } = renderHook(() => useDrafts());

        expect(result.current.drafts).toEqual({});
    });

    describe("setDraft", () => {
        it("should set a draft for a path", () => {
            const { result } = renderHook(() => useDrafts());

            act(() => {
                result.current.setDraft("test.txt", "draft content");
            });

            expect(result.current.drafts["test.txt"]).toBe("draft content");
        });

        it("should set multiple drafts for different paths", () => {
            const { result } = renderHook(() => useDrafts());

            act(() => {
                result.current.setDraft("file1.txt", "content 1");
                result.current.setDraft("file2.py", "content 2");
            });

            expect(result.current.drafts["file1.txt"]).toBe("content 1");
            expect(result.current.drafts["file2.py"]).toBe("content 2");
        });

        it("should update existing draft", () => {
            const { result } = renderHook(() => useDrafts());

            act(() => {
                result.current.setDraft("test.txt", "initial content");
            });

            expect(result.current.drafts["test.txt"]).toBe("initial content");

            act(() => {
                result.current.setDraft("test.txt", "updated content");
            });

            expect(result.current.drafts["test.txt"]).toBe("updated content");
        });

        it("should handle empty string as draft content", () => {
            const { result } = renderHook(() => useDrafts());

            act(() => {
                result.current.setDraft("empty.txt", "");
            });

            expect(result.current.drafts["empty.txt"]).toBe("");
        });
    });

    describe("clearDraft", () => {
        it("should remove a draft for a path", () => {
            const { result } = renderHook(() => useDrafts());

            act(() => {
                result.current.setDraft("test.txt", "content");
            });

            expect(result.current.drafts["test.txt"]).toBe("content");

            act(() => {
                result.current.clearDraft("test.txt");
            });

            expect(result.current.drafts["test.txt"]).toBeUndefined();
            expect("test.txt" in result.current.drafts).toBe(false);
        });

        it("should only remove the specified draft", () => {
            const { result } = renderHook(() => useDrafts());

            act(() => {
                result.current.setDraft("file1.txt", "content 1");
                result.current.setDraft("file2.txt", "content 2");
                result.current.setDraft("file3.txt", "content 3");
            });

            act(() => {
                result.current.clearDraft("file2.txt");
            });

            expect(result.current.drafts["file1.txt"]).toBe("content 1");
            expect(result.current.drafts["file2.txt"]).toBeUndefined();
            expect(result.current.drafts["file3.txt"]).toBe("content 3");
        });

        it("should handle clearing non-existent draft gracefully", () => {
            const { result } = renderHook(() => useDrafts());

            expect(() => {
                act(() => {
                    result.current.clearDraft("non-existent.txt");
                });
            }).not.toThrow();

            expect(result.current.drafts).toEqual({});
        });
    });

    describe("getDraft", () => {
        it("should return draft content for existing path", () => {
            const { result } = renderHook(() => useDrafts());

            act(() => {
                result.current.setDraft("test.txt", "test content");
            });

            const content = result.current.getDraft("test.txt");
            expect(content).toBe("test content");
        });

        it("should return undefined for non-existent path", () => {
            const { result } = renderHook(() => useDrafts());

            const content = result.current.getDraft("non-existent.txt");
            expect(content).toBeUndefined();
        });

        it("should return updated content after modification", () => {
            const { result } = renderHook(() => useDrafts());

            act(() => {
                result.current.setDraft("test.txt", "original");
            });

            expect(result.current.getDraft("test.txt")).toBe("original");

            act(() => {
                result.current.setDraft("test.txt", "modified");
            });

            expect(result.current.getDraft("test.txt")).toBe("modified");
        });
    });

    describe("isDirty", () => {
        it("should return false when no draft exists", () => {
            const { result } = renderHook(() => useDrafts());

            const isDirty = result.current.isDirty("test.txt", "original");
            expect(isDirty).toBe(false);
        });

        it("should return false when draft matches original", () => {
            const { result } = renderHook(() => useDrafts());

            act(() => {
                result.current.setDraft("test.txt", "same content");
            });

            const isDirty = result.current.isDirty("test.txt", "same content");
            expect(isDirty).toBe(false);
        });

        it("should return true when draft differs from original", () => {
            const { result } = renderHook(() => useDrafts());

            act(() => {
                result.current.setDraft("test.txt", "draft content");
            });

            const isDirty = result.current.isDirty("test.txt", "original content");
            expect(isDirty).toBe(true);
        });

        it("should return true when draft exists and no original provided", () => {
            const { result } = renderHook(() => useDrafts());

            act(() => {
                result.current.setDraft("test.txt", "draft content");
            });

            const isDirty = result.current.isDirty("test.txt");
            expect(isDirty).toBe(true);
        });

        it("should handle empty string comparisons", () => {
            const { result } = renderHook(() => useDrafts());

            act(() => {
                result.current.setDraft("test.txt", "");
            });

            expect(result.current.isDirty("test.txt", "")).toBe(false);
            expect(result.current.isDirty("test.txt", "non-empty")).toBe(true);
        });

        it("should handle undefined original value", () => {
            const { result } = renderHook(() => useDrafts());

            act(() => {
                result.current.setDraft("test.txt", "content");
            });

            const isDirty = result.current.isDirty("test.txt", undefined);
            expect(isDirty).toBe(true);
        });
    });

    describe("state persistence across hook instances", () => {
        it("should maintain drafts state across hook instances", () => {
            const { result: result1 } = renderHook(() => useDrafts());

            act(() => {
                result1.current.setDraft("persistent.txt", "persistent content");
            });

            const { result: result2 } = renderHook(() => useDrafts());

            expect(result2.current.getDraft("persistent.txt")).toBe("persistent content");
        });

        it("should share state updates between hook instances", () => {
            const { result: result1 } = renderHook(() => useDrafts());
            const { result: result2 } = renderHook(() => useDrafts());

            act(() => {
                result1.current.setDraft("shared.txt", "shared content");
            });

            expect(result2.current.getDraft("shared.txt")).toBe("shared content");

            act(() => {
                result2.current.clearDraft("shared.txt");
            });

            expect(result1.current.getDraft("shared.txt")).toBeUndefined();
        });
    });

    describe("complex scenarios", () => {
        it("should handle multiple file types with different content", () => {
            const { result } = renderHook(() => useDrafts());

            const files = [
                { path: "script.py", content: "print('hello world')" },
                { path: "config.json", content: '{"key": "value"}' },
                { path: "readme.md", content: "# Project Title" },
                { path: "style.css", content: ".class { color: red; }" },
            ];

            act(() => {
                files.forEach(file => {
                    result.current.setDraft(file.path, file.content);
                });
            });

            files.forEach(file => {
                expect(result.current.getDraft(file.path)).toBe(file.content);
                expect(result.current.isDirty(file.path, "")).toBe(true);
            });
        });

        it("should handle path-like strings correctly", () => {
            const { result } = renderHook(() => useDrafts());

            const paths = [
                "src/components/Button.tsx",
                "docs/api/endpoints.md",
                "../parent/file.txt",
                "./current/file.js",
                "file with spaces.txt",
                "file-with-dashes.yml",
            ];

            act(() => {
                paths.forEach((path, index) => {
                    result.current.setDraft(path, `content ${index}`);
                });
            });

            paths.forEach((path, index) => {
                expect(result.current.getDraft(path)).toBe(`content ${index}`);
            });
        });

        it("should handle large content efficiently", () => {
            const { result } = renderHook(() => useDrafts());

            const largeContent = "x".repeat(10000); // 10KB of content

            act(() => {
                result.current.setDraft("large-file.txt", largeContent);
            });

            expect(result.current.getDraft("large-file.txt")).toBe(largeContent);
            expect(result.current.isDirty("large-file.txt", "")).toBe(true);
        });

        it("should handle workflow: create, modify, check dirty, clear", () => {
            const { result } = renderHook(() => useDrafts());

            const path = "workflow.txt";
            const original = "original content";
            const modified = "modified content";

            // Initially no draft
            expect(result.current.isDirty(path, original)).toBe(false);

            // Create draft
            act(() => {
                result.current.setDraft(path, original);
            });

            // Not dirty if matches original
            expect(result.current.isDirty(path, original)).toBe(false);

            // Modify draft
            act(() => {
                result.current.setDraft(path, modified);
            });

            // Now dirty
            expect(result.current.isDirty(path, original)).toBe(true);

            // Clear draft
            act(() => {
                result.current.clearDraft(path);
            });

            // No longer dirty
            expect(result.current.isDirty(path, original)).toBe(false);
        });
    });

    describe("edge cases", () => {
        it("should handle special characters in path names", () => {
            const { result } = renderHook(() => useDrafts());

            const specialPaths = [
                "file@domain.com",
                "file#hash.txt",
                "file%20with%20encoded.txt",
                "file&parameter=value.txt",
                "file+plus.txt",
            ];

            act(() => {
                specialPaths.forEach((path, index) => {
                    result.current.setDraft(path, `content ${index}`);
                });
            });

            specialPaths.forEach((path, index) => {
                expect(result.current.getDraft(path)).toBe(`content ${index}`);
            });
        });

        it("should handle unicode content", () => {
            const { result } = renderHook(() => useDrafts());

            // cspell: disable-next-line
            const unicodeContent = "Hello 世界 🌍 Ñoño café résumé";

            act(() => {
                result.current.setDraft("unicode.txt", unicodeContent);
            });

            expect(result.current.getDraft("unicode.txt")).toBe(unicodeContent);
        });

        it("should maintain object reference stability for unchanged drafts", () => {
            const { result } = renderHook(() => useDrafts());

            act(() => {
                result.current.setDraft("file1.txt", "content 1");
            });

            const drafts1 = result.current.drafts;

            act(() => {
                result.current.setDraft("file2.txt", "content 2");
            });

            const drafts2 = result.current.drafts;

            // References should be different since state changed
            expect(drafts1).not.toBe(drafts2);

            // But the content should still be preserved
            expect(drafts2["file1.txt"]).toBe("content 1");
            expect(drafts2["file2.txt"]).toBe("content 2");
        });
    });
});
