/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import fs from "fs-extra";
import path, { relative, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig, normalizePath } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const THRESHOLD_LIMIT = 80;
const ENVS = {
    host: { key: "WALDIEZ_STUDIO_HOST", default: "localhost" },
    port: { key: "WALDIEZ_STUDIO_PORT", default: "8000" },
    baseUrl: { key: "WALDIEZ_STUDIO_BASE_URL", default: "/frontend/" },
};

const normalizedResolve = (...paths: string[]): string => normalizePath(resolve(__dirname, ...paths));
const coverageInclude = relative(process.cwd(), normalizedResolve("src")).replace(/\\/g, "/");
const coverageDir = relative(process.cwd(), normalizedResolve("coverage", "frontend")).replace(/\\/g, "/");
const isBrowserTest = process.argv.includes("--browser.enabled");
let relativePath = relative(process.cwd(), normalizePath(resolve(__dirname))).replace(/\\/g, "/");
if (!relativePath.endsWith("/")) {
    relativePath += "/";
}
if (relativePath.startsWith("/")) {
    relativePath = relativePath.substring(1);
}
const testsInclude = isBrowserTest
    ? `${relativePath}e2e/**/*.spec.{ts,tsx}`
    : `${relativePath}src/tests/**/*.test.{ts,tsx}`;

dotenv.config({ quiet: true, encoding: "utf8" });
const recordingsDir = normalizedResolve(".local", "recordings");
fs.ensureDirSync(recordingsDir);
const viewport = { width: 1280, height: 720 };
const thresholds = {
    statements: THRESHOLD_LIMIT,
    branches: THRESHOLD_LIMIT,
    functions: THRESHOLD_LIMIT,
    lines: THRESHOLD_LIMIT,
};

const apiDevHost = process.env[ENVS.host.key] || ENVS.host.default;
const apiDevScheme = ["localhost", "0.0.0.0", "127.0.0.1"].includes(apiDevHost) ? "http" : "https";
const apiDevWsScheme = apiDevScheme.replace("http", "ws");
let apiDevPortStr = process.env[ENVS.port.key] || ENVS.port.default;
let apiDevPort = parseInt(ENVS.port.default);
try {
    apiDevPort = parseInt(apiDevPortStr, 10);
} catch (error) {
    console.error(error);
}
if ([80, 443].includes(apiDevPort)) {
    apiDevPortStr = "";
} else {
    apiDevPortStr = `:${apiDevPortStr}`;
}
const proxy = {
    "/api": {
        target: `${apiDevScheme}://${apiDevHost}${apiDevPortStr}`,
        changeOrigin: true,
    },
    "/ws": {
        target: `${apiDevWsScheme}://${apiDevHost}${apiDevPortStr}`,
        rewriteWsOrigin: true,
        ws: true,
    },
    // monaco editor files
    "/vs": {
        target: `${apiDevScheme}://${apiDevHost}${apiDevPortStr}`,
        changeOrigin: true,
    },
    "/min-maps": {
        target: `${apiDevScheme}://${apiDevHost}${apiDevPortStr}`,
        changeOrigin: true,
    },
};

/**
 * Get the public directory based on the command.
 * @param _command - The command being executed, either "build" or "serve".
 * @returns - The path to the public directory.
 */
const getPublicDir = (_command: "build" | "serve"): string | false => {
    return normalizedResolve("public");
};

/**
 * Get the base URL for the application based on the command / mode.
 * @param command - The command being executed, either "build" or "serve".
 * @returns - The base URL as a string.
 */
const getBaseUrl = (command: "build" | "serve"): string => {
    if (command === "build") {
        const baseUrl = process.env[ENVS.baseUrl.key] || ENVS.baseUrl.default;
        if (!baseUrl.endsWith("/")) {
            return `${baseUrl}/`;
        }
        return baseUrl;
    }
    return "./";
};

type CopyTarget = { src: string; dest: string };

/**
 * Build viteStaticCopy targets safely
 */
const safeTargets = (entries: [string, string][]): CopyTarget[] => {
    return entries
        .map(([src, dest]) => {
            const abs = normalizedResolve("public", src);
            const hasGlob = src.includes("*");

            if (hasGlob) {
                const dir = abs.replace(/\/\*.*$/, ""); // strip glob part
                if (!fs.existsSync(dir)) {
                    return null;
                }
            } else if (!fs.existsSync(abs)) {
                return null;
            }

            return { src: abs, dest };
        })
        .filter((t): t is CopyTarget => t !== null);
};

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
    const envFile = normalizedResolve(".env");
    if (fs.existsSync(envFile)) {
        const envConfig = dotenv.parse(fs.readFileSync(envFile));
        process.env = { ...process.env, ...envConfig };
    }
    // noinspection JSUnusedGlobalSymbols
    return {
        publicDir: getPublicDir(command),
        base: getBaseUrl(command),
        server: {
            proxy,
        },
        build: {
            emptyOutDir: true,
            minify: "terser",
            terserOptions: {
                format: {
                    comments: false,
                },
                compress: {
                    drop_console: true,
                    drop_debugger: true,
                },
                mangle: true,
            },
            target: "esnext",
            outDir: normalizedResolve("waldiez_studio", "static", "frontend"),
            rollupOptions: {
                output: {
                    manualChunks: (id: string) => {
                        if (id.includes("node_modules")) {
                            const parts = id.split("node_modules/");
                            if (parts.length > 0 && parts[1]) {
                                return parts[1].split("/")[0];
                            }
                        }
                    },
                },
                // cspell: disable-next-line
                onwarn(warning, warn) {
                    // Suppress specific "empty chunk" harmless warnings
                    if (warning.code === "EMPTY_BUNDLE") {
                        return;
                    }
                    warn(warning);
                },
            },
        },
        plugins: [
            react(),
            tailwindcss(),
            viteStaticCopy({
                targets: safeTargets([
                    ["icons/*", "icons"],
                    ["screenshots/*", "screenshots"],
                    ["apple-touch-icon.png", ""],
                    ["favicon.ico", ""],
                    ["icon.icns", ""],
                    ["robots.txt", ""],
                    ["browserconfig.xml", ""],
                    ["site.webmanifest", ""],
                    // optional? (might not exist)
                    ["vs/*", "vs"],
                    ["min-maps/*", "min-maps"],
                    ["monaco.json", ""],
                ]),
            }),
        ],
        resolve: {
            alias: {
                "@": normalizedResolve("src"),
            },
        },
        test: {
            include: [testsInclude],
            // support `describe`, `test` etc. globally,
            globals: true,
            // pool: 'vmThreads',
            // isolate: false,
            bail: 1,
            // run tests in jsdom environment
            environment: "jsdom",
            coverage: {
                provider: "v8",
                reporter: ["lcov", "text", "text-summary", "html"],
                include: [coverageInclude],
                reportsDirectory: coverageDir,
                exclude: [
                    // auto generated from shadcn
                    "src/components/ui/button.tsx",
                    "src/components/ui/input.tsx",
                    "src/components/ui/card.tsx",
                    "src/components/ui/alert.tsx",
                    "src/components/ui/badge.tsx",
                    "src/components/ui/dropdown-menu.tsx",
                    "src/components/ui/select.tsx",
                    "src/components/ui/table.tsx",
                    "src/components/ui/tabs.tsx",
                    "src/components/ui/resizable.tsx",
                ],
                ignoreEmptyLines: true,
                thresholds,
                all: true,
            },
            // global test setup
            setupFiles: isBrowserTest ? [] : [normalizedResolve("vitest.setup.tsx")],
            // browser setup is in workspace
            browser: {
                provider: "playwright", // or 'webdriverio'
                enabled: isBrowserTest,
                headless: true,
                viewport,
                instances: [
                    {
                        browser: "chromium",
                        context: {
                            recordVideo: {
                                dir: recordingsDir,
                                size: viewport,
                            },
                            viewport,
                            reducedMotion: "reduce",
                        },
                    },
                ],
            },
        },
    };
});
