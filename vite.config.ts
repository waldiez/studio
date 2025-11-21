/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import dotenv from "dotenv";
import fs from "fs-extra";
import path, { relative, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig, normalizePath } from "vite";

import { transformPublicFiles } from "./vite.plugins";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const THRESHOLD_LIMIT = 80;
const ENVS = {
    host: { key: "WALDIEZ_STUDIO_HOST", default: "localhost" },
    port: { key: "WALDIEZ_STUDIO_PORT", default: "8000" },
    baseUrl: { key: "WALDIEZ_STUDIO_BASE_URL", default: "/" },
};

const normalizedResolve = (...paths: string[]): string => normalizePath(resolve(__dirname, ...paths));
const outDir = normalizedResolve("waldiez_studio", "static", "frontend");
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
/**
 * Get the base URL for the application based on the command / mode.
 * @param command - The command being executed, either "build" or "serve".
 * @returns - The base URL as a string.
 */
const getBaseUrl = (command: "build" | "serve"): string => {
    let baseUrl = process.env[ENVS.baseUrl.key] || ENVS.baseUrl.default;
    if (!baseUrl.endsWith("/")) {
        baseUrl = `${baseUrl}/`;
    }
    if (!baseUrl.startsWith("/")) {
        baseUrl = `/${baseUrl}`;
    }
    if (baseUrl === "/" && command == "serve") {
        baseUrl = "./";
    }
    return baseUrl;
};
const getProxy = (_command: "build" | "serve") => {
    const urlBase = getBaseUrl(_command);
    const baseUrl = urlBase.length > 1 ? urlBase.slice(1, urlBase.length - 1) : urlBase;
    return {
        "/api": {
            target: `${apiDevScheme}://${apiDevHost}${apiDevPortStr}/${baseUrl}`,
            changeOrigin: true,
        },
        "/ws": {
            target: `${apiDevWsScheme}://${apiDevHost}${apiDevPortStr}/${baseUrl}`,
            rewriteWsOrigin: true,
            ws: true,
        },
        // monaco editor files
        "/vs": {
            target: `${apiDevScheme}://${apiDevHost}${apiDevPortStr}/${baseUrl}`,
            changeOrigin: true,
        },
    };
};

/**
 * Get the public directory based on the command.
 * @param _command - The command being executed, either "build" or "serve".
 * @returns - The path to the public directory.
 */
const getPublicDir = (_command: "build" | "serve"): string | false => {
    return normalizedResolve("public");
};

const removeSlashes = (base: string) => {
    let withoutSlashes = base.replace("./", "/");
    while (withoutSlashes.endsWith("/")) {
        withoutSlashes = withoutSlashes.slice(0, withoutSlashes.length - 1);
    }
    while (withoutSlashes.startsWith("/")) {
        withoutSlashes = withoutSlashes.slice(1, withoutSlashes.length);
    }
    return withoutSlashes;
};

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
    const envFile = normalizedResolve(".env");
    if (fs.existsSync(envFile)) {
        const envConfig = dotenv.parse(fs.readFileSync(envFile));
        process.env = { ...process.env, ...envConfig };
    }
    const base = getBaseUrl(command);
    const withoutSlashes = removeSlashes(base);
    const basePrefix = withoutSlashes !== "" ? `/${withoutSlashes}/` : "/";
    const replacement = withoutSlashes !== "" ? `${withoutSlashes}/frontend` : "frontend";
    const dev = command == "serve";
    // noinspection JSUnusedGlobalSymbols
    return {
        publicDir: getPublicDir(command),
        base: dev ? base : `${base}frontend/`,
        server: {
            proxy: getProxy(command),
            ignored: [
                "**/node_modules/**",
                "**/.git/**",
                "**/.venv/**",
                "**/.local/**",
                "**/coverage/**",
                "**/__pycache__/**",
                "**/.mypy_cache/**",
                "**/.pytest_cache/**",
                "**/.ruff_cache/**",
                "**/out/**",
                "**/dist/**",
                "/waldiez_studio/**",
                "/tests/**",
            ],
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
            outDir,
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
        plugins: [react(), tailwindcss(), transformPublicFiles(outDir, replacement)],
        resolve: {
            alias: {
                "@": normalizedResolve("src"),
            },
        },
        define: {
            WALDIEZ_STUDIO_API_PREFIX: dev
                ? JSON.stringify(`${basePrefix}api`)
                : JSON.stringify("__WALDIEZ_STUDIO_API__/api"),
            WALDIEZ_STUDIO_WS_PREFIX: dev
                ? JSON.stringify(`${basePrefix}ws`)
                : JSON.stringify("__WALDIEZ_STUDIO_WS__/ws"),
            WALDIEZ_STUDIO_VS_PREFIX: dev
                ? JSON.stringify(`${basePrefix}vs`)
                : JSON.stringify("__WALDIEZ_STUDIO_VS__/vs"),
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
                experimentalAstAwareRemapping: true,
                exclude: [
                    "**/.DS_Store",
                    "**/*.css",
                    "src/lib/utils.ts",
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
                provider: playwright(),
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
