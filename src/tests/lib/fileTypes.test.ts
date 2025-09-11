/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import {
    guessLanguage,
    routeByExt,
    routeFile,
    type FileRoute,
    type ViewerKind,
} from "@/lib/fileTypes";

import { describe, expect, it } from "vitest";

describe("fileTypes", () => {
    describe("types", () => {
        it("should define ViewerKind correctly", () => {
            const kinds: ViewerKind[] = ["code", "notebook", "mermaid", "markdown", "media", "binary"];
            expect(kinds).toHaveLength(6);
        });

        it("should define FileRoute structure", () => {
            const route1: FileRoute = { kind: "code", language: "python" };
            const route2: FileRoute = { kind: "media" };

            expect(route1.kind).toBe("code");
            expect(route1.language).toBe("python");
            expect(route2.kind).toBe("media");
            expect(route2.language).toBeUndefined();
        });
    });

    describe("routeByExt", () => {
        it("should map code file extensions correctly", () => {
            expect(routeByExt[".py"]).toEqual({ kind: "code", language: "python" });
            expect(routeByExt[".ts"]).toEqual({ kind: "code", language: "typescript" });
            expect(routeByExt[".js"]).toEqual({ kind: "code", language: "javascript" });
            expect(routeByExt[".json"]).toEqual({ kind: "code", language: "json" });
            expect(routeByExt[".html"]).toEqual({ kind: "code", language: "html" });
            expect(routeByExt[".css"]).toEqual({ kind: "code", language: "css" });
            expect(routeByExt[".waldiez"]).toEqual({ kind: "code", language: "waldiez" });
        });

        it("should map document file extensions correctly", () => {
            expect(routeByExt[".md"]).toEqual({ kind: "markdown" });
            expect(routeByExt[".mmd"]).toEqual({ kind: "mermaid" });
            expect(routeByExt[".ipynb"]).toEqual({ kind: "notebook" });
        });

        it("should map media file extensions correctly", () => {
            const mediaExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".webm", ".ogg", ".wav", ".svg"];

            mediaExtensions.forEach(ext => {
                expect(routeByExt[ext]).toEqual({ kind: "media" });
            });
        });
    });

    describe("guessLanguage", () => {
        describe("code languages", () => {
            it("should detect Python files", () => {
                expect(guessLanguage("script.py")).toBe("python");
                expect(guessLanguage("Script.PY")).toBe("python");
                expect(guessLanguage("SCRIPT.Py")).toBe("python");
            });

            it("should detect TypeScript files", () => {
                expect(guessLanguage("component.ts")).toBe("typescript");
                expect(guessLanguage("Component.tsx")).toBe("typescript");
                expect(guessLanguage("FILE.TS")).toBe("typescript");
                expect(guessLanguage("file.TSX")).toBe("typescript");
            });

            it("should detect JavaScript files", () => {
                expect(guessLanguage("script.js")).toBe("javascript");
                expect(guessLanguage("Component.jsx")).toBe("javascript");
                expect(guessLanguage("SCRIPT.JS")).toBe("javascript");
                expect(guessLanguage("component.JSX")).toBe("javascript");
            });

            it("should detect JSON files", () => {
                expect(guessLanguage("package.json")).toBe("json");
                expect(guessLanguage("CONFIG.JSON")).toBe("json");
            });

            it("should detect CSS files", () => {
                expect(guessLanguage("styles.css")).toBe("css");
                expect(guessLanguage("STYLES.CSS")).toBe("css");
            });

            it("should detect HTML files", () => {
                expect(guessLanguage("index.html")).toBe("html");
                expect(guessLanguage("INDEX.HTML")).toBe("html");
            });

            it("should detect XML files", () => {
                expect(guessLanguage("config.xml")).toBe("xml");
                expect(guessLanguage("CONFIG.XML")).toBe("xml");
            });

            it("should detect YAML files", () => {
                expect(guessLanguage("config.yml")).toBe("yaml");
                expect(guessLanguage("docker-compose.yaml")).toBe("yaml");
                expect(guessLanguage("CONFIG.YML")).toBe("yaml");
                expect(guessLanguage("FILE.YAML")).toBe("yaml");
            });

            it("should detect TOML files", () => {
                expect(guessLanguage("pyproject.toml")).toBe("toml");
                expect(guessLanguage("CONFIG.TOML")).toBe("toml");
            });

            it("should detect INI files", () => {
                expect(guessLanguage("config.ini")).toBe("ini");
                expect(guessLanguage("SETTINGS.INI")).toBe("ini");
            });

            it("should detect Waldiez files", () => {
                expect(guessLanguage("flow.waldiez")).toBe("waldiez");
                expect(guessLanguage("AGENT.WALDIEZ")).toBe("waldiez");
            });
        });

        describe("markdown files", () => {
            it("should detect markdown files", () => {
                expect(guessLanguage("README.md")).toBe("markdown");
                expect(guessLanguage("docs.MD")).toBe("markdown");
            });

            it("should detect mermaid files", () => {
                expect(guessLanguage("diagram.mmd")).toBe("markdown");
                expect(guessLanguage("FLOW.MMD")).toBe("markdown");
            });
        });

        describe("unknown files", () => {
            it("should return plaintext for unknown extensions", () => {
                expect(guessLanguage("file.unknown")).toBe("plaintext");
                expect(guessLanguage("binary.bin")).toBe("plaintext");
                expect(guessLanguage("data.dat")).toBe("plaintext");
                expect(guessLanguage("archive.zip")).toBe("plaintext");
            });

            it("should return plaintext for files without extensions", () => {
                expect(guessLanguage("README")).toBe("plaintext");
                expect(guessLanguage("Makefile")).toBe("plaintext");
                expect(guessLanguage("LICENSE")).toBe("plaintext");
            });

            it("should return plaintext for empty strings", () => {
                expect(guessLanguage("")).toBe("plaintext");
            });
        });

        describe("case insensitivity", () => {
            it("should handle mixed case extensions", () => {
                expect(guessLanguage("File.Py")).toBe("python");
                expect(guessLanguage("Script.Js")).toBe("javascript");
                expect(guessLanguage("Style.Css")).toBe("css");
                expect(guessLanguage("Config.Json")).toBe("json");
            });
        });

        describe("complex filenames", () => {
            it("should handle filenames with multiple dots", () => {
                expect(guessLanguage("config.local.json")).toBe("json");
                expect(guessLanguage("component.test.ts")).toBe("typescript");
                expect(guessLanguage("styles.min.css")).toBe("css");
            });

            it("should handle paths", () => {
                expect(guessLanguage("src/components/Button.tsx")).toBe("typescript");
                expect(guessLanguage("/path/to/script.py")).toBe("python");
                expect(guessLanguage("../relative/path/file.js")).toBe("javascript");
            });
        });
    });

    describe("routeFile", () => {
        describe("code files", () => {
            it("should route Python files", () => {
                expect(routeFile("script.py")).toEqual({ kind: "code", language: "python" });
                expect(routeFile("SCRIPT.PY")).toEqual({ kind: "code", language: "python" });
            });

            it("should route TypeScript files", () => {
                expect(routeFile("component.ts")).toEqual({ kind: "code", language: "typescript" });
                expect(routeFile("COMPONENT.TS")).toEqual({ kind: "code", language: "typescript" });
            });

            it("should route JavaScript files", () => {
                expect(routeFile("script.js")).toEqual({ kind: "code", language: "javascript" });
                expect(routeFile("SCRIPT.JS")).toEqual({ kind: "code", language: "javascript" });
            });

            it("should route JSON files", () => {
                expect(routeFile("package.json")).toEqual({ kind: "code", language: "json" });
                expect(routeFile("CONFIG.JSON")).toEqual({ kind: "code", language: "json" });
            });

            it("should route HTML files", () => {
                expect(routeFile("index.html")).toEqual({ kind: "code", language: "html" });
                expect(routeFile("INDEX.HTML")).toEqual({ kind: "code", language: "html" });
            });

            it("should route CSS files", () => {
                expect(routeFile("styles.css")).toEqual({ kind: "code", language: "css" });
                expect(routeFile("STYLES.CSS")).toEqual({ kind: "code", language: "css" });
            });

            it("should route Waldiez files", () => {
                expect(routeFile("flow.waldiez")).toEqual({ kind: "code", language: "waldiez" });
                expect(routeFile("AGENT.WALDIEZ")).toEqual({ kind: "code", language: "waldiez" });
            });
        });

        describe("document files", () => {
            it("should route markdown files", () => {
                expect(routeFile("README.md")).toEqual({ kind: "markdown" });
                expect(routeFile("DOCS.MD")).toEqual({ kind: "markdown" });
            });

            it("should route mermaid files", () => {
                expect(routeFile("diagram.mmd")).toEqual({ kind: "mermaid" });
                expect(routeFile("FLOW.MMD")).toEqual({ kind: "mermaid" });
            });

            it("should route notebook files", () => {
                expect(routeFile("analysis.ipynb")).toEqual({ kind: "notebook" });
                expect(routeFile("NOTEBOOK.IPYNB")).toEqual({ kind: "notebook" });
            });
        });

        describe("media files", () => {
            it("should route image files", () => {
                expect(routeFile("image.png")).toEqual({ kind: "media" });
                expect(routeFile("photo.jpg")).toEqual({ kind: "media" });
                expect(routeFile("picture.jpeg")).toEqual({ kind: "media" });
                expect(routeFile("animation.gif")).toEqual({ kind: "media" });
                expect(routeFile("modern.webp")).toEqual({ kind: "media" });
                expect(routeFile("vector.svg")).toEqual({ kind: "media" });
            });

            it("should route video files", () => {
                expect(routeFile("video.mp4")).toEqual({ kind: "media" });
                expect(routeFile("clip.webm")).toEqual({ kind: "media" });
            });

            it("should route audio files", () => {
                expect(routeFile("audio.ogg")).toEqual({ kind: "media" });
                expect(routeFile("sound.wav")).toEqual({ kind: "media" });
            });
        });

        describe("binary files", () => {
            it("should route unknown extensions as binary", () => {
                expect(routeFile("file.unknown")).toEqual({ kind: "binary" });
                expect(routeFile("data.bin")).toEqual({ kind: "binary" });
                expect(routeFile("archive.zip")).toEqual({ kind: "binary" });
                expect(routeFile("executable.exe")).toEqual({ kind: "binary" });
            });

            it("should route files without extensions as binary", () => {
                expect(routeFile("README")).toEqual({ kind: "binary" });
                expect(routeFile("Makefile")).toEqual({ kind: "binary" });
                expect(routeFile("LICENSE")).toEqual({ kind: "binary" });
            });

            it("should handle empty filenames", () => {
                expect(routeFile("")).toEqual({ kind: "binary" });
            });
        });

        describe("case insensitivity", () => {
            it("should handle mixed case extensions", () => {
                expect(routeFile("File.Py")).toEqual({ kind: "code", language: "python" });
                expect(routeFile("Image.Png")).toEqual({ kind: "media" });
                expect(routeFile("Doc.Md")).toEqual({ kind: "markdown" });
            });
        });

        describe("complex filenames", () => {
            it("should handle filenames with multiple dots", () => {
                expect(routeFile("config.local.json")).toEqual({ kind: "code", language: "json" });
                expect(routeFile("component.test.ts")).toEqual({ kind: "code", language: "typescript" });
                expect(routeFile("image.backup.png")).toEqual({ kind: "media" });
            });

            it("should handle paths", () => {
                expect(routeFile("src/components/Button.tsx")).toEqual({ kind: "binary" }); // .tsx not in routeByExt
                expect(routeFile("/path/to/script.py")).toEqual({ kind: "code", language: "python" });
                expect(routeFile("../relative/path/image.png")).toEqual({ kind: "media" });
            });
        });
    });

    describe("edge cases", () => {
        it("should handle dotfiles", () => {
            expect(guessLanguage(".env")).toBe("plaintext");
            expect(guessLanguage(".gitignore")).toBe("plaintext");
            expect(routeFile(".hidden")).toEqual({ kind: "binary" });
        });

        it("should handle files ending with just a dot", () => {
            expect(guessLanguage("file.")).toBe("plaintext");
            expect(routeFile("file.")).toEqual({ kind: "binary" });
        });

        it("should handle special characters in filenames", () => {
            expect(guessLanguage("file-name.py")).toBe("python");
            expect(guessLanguage("file_name.js")).toBe("javascript");
            expect(guessLanguage("file name.json")).toBe("json");
            expect(routeFile("file-name.py")).toEqual({ kind: "code", language: "python" });
        });
    });
});
