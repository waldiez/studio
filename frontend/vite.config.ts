/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import fs from "fs-extra";
import path, { relative, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig, normalizePath } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const normalizedResolve = (...paths: string[]): string => normalizePath(resolve(__dirname, ...paths));
const coverageInclude = relative(process.cwd(), normalizedResolve("src")).replace(/\\/g, "/");
const coverageDir = relative(process.cwd(), normalizedResolve("..", "coverage", "frontend")).replace(
    /\\/g,
    "/",
);
const isBrowserTest = process.argv.includes("--browser.enabled");
//  isBrowserTest ? "e2e/**/*.spec.{ts,tsx}" : "tests/**/*.test.{ts,tsx}"
let relativePath = relative(process.cwd(), normalizePath(resolve(__dirname))).replace(/\\/g, "/");
if (!relativePath.endsWith("/")) {
    relativePath += "/";
}
if (relativePath.startsWith("/")) {
    relativePath = relativePath.substring(1);
}
const testsInclude = isBrowserTest
    ? `${relativePath}e2e/**/*.spec.{ts,tsx}`
    : `${relativePath}tests/**/*.test.{ts,tsx}`;

dotenv.config();
const recordingsDir = normalizedResolve(".local", "recordings");
fs.ensureDirSync(recordingsDir);
const thresholdLimit = 50;
const viewport = { width: 1280, height: 720 };
const thresholds = {
    statements: thresholdLimit,
    branches: thresholdLimit,
    functions: thresholdLimit,
    lines: thresholdLimit,
};

const apiDevHost = process.env["WALDIEZ_STUDIO_HOST"] || "localhost";
const apiDevScheme = ["localhost", "0.0.0.0", "127.0.0.1"].includes(apiDevHost) ? "http" : "https";
const apiDevWsScheme = apiDevScheme.replace("http", "ws");
let apiDevPortStr = process.env["WALDIEZ_STUDIO_PORT"] || "8000";
let apiDevPort = 8000;
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
    "/min-maps": {
        target: `${apiDevScheme}://${apiDevHost}${apiDevPortStr}`,
        changeOrigin: true,
    },
    "/monaco": {
        target: `${apiDevScheme}://${apiDevHost}${apiDevPortStr}`,
        changeOrigin: true,
    },
    "/ws": {
        target: `${apiDevWsScheme}://${apiDevHost}${apiDevPortStr}`,
        rewriteWsOrigin: true,
        ws: true,
    },
};

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
    const envFile = normalizedResolve("..", ".env");
    if (fs.existsSync(envFile)) {
        const envConfig = dotenv.parse(fs.readFileSync(envFile));
        process.env = { ...process.env, ...envConfig };
    }

    let base = command === "build" ? process.env["WALDIEZ_STUDIO_BASE_URL"] || "/frontend/" : "/";
    if (!base.endsWith("/")) {
        base += "/";
    }
    const publicDir =
        command === "build" ? normalizedResolve("..", "public", "files") : normalizedResolve("..", "public");
    // noinspection JSUnusedGlobalSymbols
    return {
        publicDir,
        base,
        server: {
            proxy,
        },
        build: {
            emptyOutDir: true,
            minify: "terser",
            terserOptions: {
                compress: {
                    drop_console: true,
                    drop_debugger: true,
                },
            },
            target: "esnext",
            outDir: normalizedResolve("..", "waldiez_studio", "static", "frontend"),
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes("node_modules")) {
                            return id.toString().split("node_modules/")[1].split("/")[0].toString();
                        }
                    },
                },
            },
        },
        plugins: [react()],
        resolve: {
            alias: {
                "@waldiez/studio": normalizedResolve("src"),
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
                exclude: [],
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
