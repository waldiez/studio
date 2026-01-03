/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import { dirname, equalPaths, extOf, isRunnable, isWaldiez, normalizePath } from "@/utils/paths";
import { describe, expect, it } from "vitest";

describe("paths utilities", () => {
    describe("extOf", () => {
        it("should extract file extensions correctly", () => {
            expect(extOf("file.txt")).toBe(".txt");
            expect(extOf("script.py")).toBe(".py");
            expect(extOf("notebook.ipynb")).toBe(".ipynb");
            expect(extOf("flow.waldiez")).toBe(".waldiez");
        });

        it("should handle uppercase extensions", () => {
            expect(extOf("FILE.TXT")).toBe(".txt");
            expect(extOf("Script.PY")).toBe(".py");
            expect(extOf("NOTEBOOK.IPYNB")).toBe(".ipynb");
        });

        it("should handle mixed case extensions", () => {
            expect(extOf("file.PyThOn")).toBe(".python");
            expect(extOf("test.iPyNb")).toBe(".ipynb");
        });

        it("should handle files without extensions", () => {
            expect(extOf("README")).toBe("");
            expect(extOf("Makefile")).toBe("");
            expect(extOf("")).toBe("");
        });

        it("should handle files with multiple dots", () => {
            expect(extOf("archive.tar.gz")).toBe(".gz");
            expect(extOf("config.local.json")).toBe(".json");
            expect(extOf("test.backup.py")).toBe(".py");
        });

        it("should handle hidden files", () => {
            expect(extOf(".gitignore")).toBe("");
            expect(extOf(".env")).toBe("");
            expect(extOf(".hidden.txt")).toBe("");
        });

        it("should handle edge cases", () => {
            expect(extOf(".")).toBe("");
            expect(extOf("..")).toBe("");
            expect(extOf("file.")).toBe(".");
            expect(extOf("path/to/file.txt")).toBe(".txt");
        });
    });

    describe("dirname", () => {
        it("should extract directory names correctly", () => {
            expect(dirname("path/to/file.txt")).toBe("path/to");
            expect(dirname("folder/script.py")).toBe("folder");
            expect(dirname("deep/nested/folder/file.js")).toBe("deep/nested/folder");
        });

        it("should handle root level files", () => {
            expect(dirname("file.txt")).toBe("");
            expect(dirname("README.md")).toBe("");
        });

        it("should handle paths with leading slashes", () => {
            expect(dirname("/path/to/file.txt")).toBe("path/to");
            expect(dirname("/file.txt")).toBe("");
        });

        it("should handle paths with trailing slashes", () => {
            expect(dirname("path/to/folder/")).toBe("path/to");
            expect(dirname("folder/")).toBe("");
        });

        it("should handle multiple consecutive slashes", () => {
            expect(dirname("path//to///file.txt")).toBe("path/to");
            expect(dirname("///path/file.txt")).toBe("path");
        });

        it("should handle empty and edge cases", () => {
            expect(dirname("")).toBe("");
            expect(dirname("/")).toBe("");
            expect(dirname("//")).toBe("");
        });

        it("should handle single directory", () => {
            expect(dirname("folder")).toBe("");
            expect(dirname("folder/")).toBe("");
        });
    });

    describe("isRunnable", () => {
        it("should identify runnable Python files", () => {
            expect(isRunnable("script.py")).toBe(true);
            expect(isRunnable("main.PY")).toBe(true);
            expect(isRunnable("test.Py")).toBe(true);
        });

        it("should identify runnable Waldiez files", () => {
            expect(isRunnable("flow.waldiez")).toBe(true);
            expect(isRunnable("agent.WALDIEZ")).toBe(true);
            expect(isRunnable("test.Waldiez")).toBe(true);
        });

        it("should reject non-runnable files", () => {
            expect(isRunnable("document.txt")).toBe(false);
            expect(isRunnable("image.png")).toBe(false);
            expect(isRunnable("config.json")).toBe(false);
            expect(isRunnable("style.css")).toBe(false);
            expect(isRunnable("component.jsx")).toBe(false);
        });

        it("should handle null and undefined", () => {
            expect(isRunnable(null)).toBe(false);
            expect(isRunnable(undefined)).toBe(false);
            expect(isRunnable("")).toBe(false);
        });

        it("should handle files without extensions", () => {
            expect(isRunnable("README")).toBe(false);
            expect(isRunnable("Makefile")).toBe(false);
        });

        it("should handle paths with directories", () => {
            expect(isRunnable("src/main.py")).toBe(true);
            expect(isRunnable("flows/agent.waldiez")).toBe(true);
            expect(isRunnable("docs/readme.txt")).toBe(false);
        });
    });

    describe("normalizePath", () => {
        it("should normalize backslashes to forward slashes", () => {
            expect(normalizePath("path\\to\\file.txt")).toBe("path/to/file.txt");
            expect(normalizePath("folder\\script.py")).toBe("folder/script.py");
        });

        it("should remove leading slashes", () => {
            expect(normalizePath("/path/to/file.txt")).toBe("path/to/file.txt");
            expect(normalizePath("///multiple/leading/slashes")).toBe("multiple/leading/slashes");
            expect(normalizePath("/single/file.py")).toBe("single/file.py");
        });

        it("should handle mixed slash types", () => {
            expect(normalizePath("/path\\to/file.txt")).toBe("path/to/file.txt");
            expect(normalizePath("\\windows\\path/mixed")).toBe("windows/path/mixed");
        });

        it("should handle already normalized paths", () => {
            expect(normalizePath("path/to/file.txt")).toBe("path/to/file.txt");
            expect(normalizePath("simple.py")).toBe("simple.py");
        });

        it("should handle empty and edge cases", () => {
            expect(normalizePath("")).toBe("");
            expect(normalizePath("/")).toBe("");
            expect(normalizePath("//")).toBe("");
            expect(normalizePath("\\\\")).toBe("");
        });

        it("should preserve relative path structure", () => {
            expect(normalizePath("../parent/file.txt")).toBe("../parent/file.txt");
            expect(normalizePath("./current/file.py")).toBe("./current/file.py");
        });
    });

    describe("equalPaths", () => {
        it("should compare normalized paths correctly", () => {
            expect(equalPaths("path/to/file.txt", "path/to/file.txt")).toBe(true);
            expect(equalPaths("/path/to/file.txt", "path/to/file.txt")).toBe(true);
            expect(equalPaths("path\\to\\file.txt", "path/to/file.txt")).toBe(true);
        });

        it("should handle different paths", () => {
            expect(equalPaths("path/to/file1.txt", "path/to/file2.txt")).toBe(false);
            expect(equalPaths("different/path.txt", "another/path.txt")).toBe(false);
        });

        it("should handle null and undefined", () => {
            expect(equalPaths(null, "path/to/file.txt")).toBe(false);
            expect(equalPaths("path/to/file.txt", null)).toBe(false);
            expect(equalPaths(undefined, "path/to/file.txt")).toBe(false);
            expect(equalPaths("path/to/file.txt", undefined)).toBe(false);
            expect(equalPaths(null, null)).toBe(false);
            expect(equalPaths(undefined, undefined)).toBe(false);
        });

        it("should handle empty strings", () => {
            expect(equalPaths("", "")).toBe(false);
            expect(equalPaths("", "path/to/file.txt")).toBe(false);
            expect(equalPaths("path/to/file.txt", "")).toBe(false);
        });

        it("should handle complex path comparisons", () => {
            expect(equalPaths("/path///to//file.txt", "path/to/file.txt")).toBe(true);
            expect(equalPaths("\\\\\\\\path\\\\\\\\to\\\\\\\\file.txt", "path/to/file.txt")).toBe(true);
            expect(equalPaths("/path\\to/file.txt", "path/to/file.txt")).toBe(true);
        });

        it("should be case sensitive", () => {
            expect(equalPaths("Path/To/File.txt", "path/to/file.txt")).toBe(false);
            expect(equalPaths("FILE.PY", "file.py")).toBe(false);
        });
    });

    describe("isWaldiez", () => {
        it("should identify Waldiez files correctly", () => {
            expect(isWaldiez("flow.waldiez")).toBe(true);
            expect(isWaldiez("agent.waldiez")).toBe(true);
            expect(isWaldiez("complex-flow.waldiez")).toBe(true);
        });

        it("should handle uppercase extensions", () => {
            expect(isWaldiez("flow.WALDIEZ")).toBe(true);
            expect(isWaldiez("agent.Waldiez")).toBe(true);
            expect(isWaldiez("test.WaLdIeZ")).toBe(true);
        });

        it("should reject non-Waldiez files", () => {
            expect(isWaldiez("script.py")).toBe(false);
            expect(isWaldiez("notebook.ipynb")).toBe(false);
            expect(isWaldiez("document.txt")).toBe(false);
            expect(isWaldiez("config.json")).toBe(false);
        });

        it("should handle files without extensions", () => {
            expect(isWaldiez("README")).toBe(false);
            expect(isWaldiez("waldiez")).toBe(false); // No extension
        });

        it("should handle files with waldiez in name but different extension", () => {
            expect(isWaldiez("waldiez.py")).toBe(false);
            expect(isWaldiez("waldiez.txt")).toBe(false);
            expect(isWaldiez("my-waldiez-file.json")).toBe(false);
        });

        it("should handle paths with directories", () => {
            expect(isWaldiez("flows/main.waldiez")).toBe(true);
            expect(isWaldiez("src/agents/helper.waldiez")).toBe(true);
            expect(isWaldiez("examples/simple/flow.waldiez")).toBe(true);
        });

        it("should handle multiple dots in filename", () => {
            expect(isWaldiez("flow.backup.waldiez")).toBe(true);
            expect(isWaldiez("agent.v2.waldiez")).toBe(true);
            expect(isWaldiez("test.old.py")).toBe(false);
        });

        it("should handle edge cases", () => {
            expect(isWaldiez(".waldiez")).toBe(false); // Hidden waldiez file
            expect(isWaldiez("file.")).toBe(false);
            expect(isWaldiez("")).toBe(false);
        });
    });

    describe("integration scenarios", () => {
        it("should work together for file processing workflow", () => {
            const filePath = "/workspace\\flows/agent.waldiez";

            // Normalize the path
            const normalized = normalizePath(filePath);
            expect(normalized).toBe("workspace/flows/agent.waldiez");

            // Check if it's runnable
            expect(isRunnable(normalized)).toBe(true);

            // Check if it's a waldiez file
            expect(isWaldiez(normalized)).toBe(true);

            // Get the directory
            expect(dirname(normalized)).toBe("workspace/flows");

            // Get the extension
            expect(extOf(normalized)).toBe(".waldiez");
        });

        it("should handle complex path comparisons", () => {
            const path1 = "/workspace\\src/main.py";
            const path2 = "workspace/src/main.py";
            const path3 = "workspace\\src\\main.py";

            expect(equalPaths(path1, path2)).toBe(true);
            expect(equalPaths(path2, path3)).toBe(true);
            expect(equalPaths(path1, path3)).toBe(true);
        });

        it("should identify runnable files correctly in various formats", () => {
            const files = [
                "script.py",
                "SCRIPT.PY",
                "flow.waldiez",
                "FLOW.WALDIEZ",
                "notebook.ipynb", // Not in RUNNABLE_EXTS based on the code
                "document.txt",
                "image.png",
            ];

            expect(isRunnable(files[0])).toBe(true); // .py
            expect(isRunnable(files[1])).toBe(true); // .PY
            expect(isRunnable(files[2])).toBe(true); // .waldiez
            expect(isRunnable(files[3])).toBe(true); // .WALDIEZ
            expect(isRunnable(files[4])).toBe(false); // .ipynb not in RUNNABLE_EXTS
            expect(isRunnable(files[5])).toBe(false); // .txt
            expect(isRunnable(files[6])).toBe(false); // .png
        });
    });
});
