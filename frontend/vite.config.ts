/* eslint-disable complexity */
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import fs from "fs-extra";
import path from "path";
import { relative, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const coverageInclude = relative(process.cwd(), resolve(__dirname, "src")).replace(/\\/g, "/");
const coverageDir = relative(process.cwd(), resolve(__dirname, "..", "coverage", "frontend")).replace(
    /\\/g,
    "/",
);
const isBrowserTest = process.argv.includes("--browser.enabled");
//  isBrowserTest ? "e2e/**/*.spec.{ts,tsx}" : "tests/**/*.test.{ts,tsx}"
let relativePath = relative(process.cwd(), resolve(__dirname)).replace(/\\/g, "/");
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

const thresholdLimit = 50;
const viewport = { width: 1280, height: 720 };
const thresholds = {
    statements: thresholdLimit,
    branches: thresholdLimit,
    functions: thresholdLimit,
    lines: thresholdLimit,
};

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
    const envFile = resolve(__dirname, "..", ".env");
    if (fs.existsSync(envFile)) {
        const envConfig = dotenv.parse(fs.readFileSync(envFile));
        process.env = { ...process.env, ...envConfig };
    }
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
    const apiDevHost = process.env["WALDIEZ_STUDIO_HOST"] || "localhost";
    const apiDevScheme = ["localhost", "0.0.0.0", "127.0.0.1"].includes(apiDevHost) ? "http" : "https";
    let base = command === "build" ? process.env["WALDIEZ_STUDIO_BASE_URL"] || "/frontend/" : "/";
    if (!base.endsWith("/")) {
        base += "/";
    }
    const publicDir =
        command === "build"
            ? resolve(__dirname, "..", "public", "files")
            : resolve(__dirname, "..", "public");
    const apiDewsScheme = apiDevScheme.replace("http", "ws");
    return {
        publicDir,
        base,
        server: {
            proxy: {
                "/api": {
                    target: `${apiDevScheme}://${apiDevHost}${apiDevPortStr}`,
                    changeOrigin: true,
                },
                "/ws": {
                    target: `${apiDewsScheme}://${apiDevHost}${apiDevPortStr}`,
                    rewriteWsOrigin: true,
                    ws: true,
                },
            },
        },
        build: {
            emptyOutDir: true,
            minify: "terser",
            outDir: resolve(__dirname, "..", "waldiez_studio", "static", "frontend"),
            rollupOptions: {
                output: {
                    manualChunks: {
                        react: ["react"],
                        "react-dom": ["react-dom"],
                        "xyflow-react": ["@xyflow/react"],
                        "waldiez-react": ["@waldiez/react"],
                    },
                },
            },
        },
        plugins: [react()],
        resolve: {
            alias: {
                "@waldiez/studio": resolve(__dirname, "src"),
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
            setupFiles: isBrowserTest ? [] : [resolve(__dirname, "vitest.setup.tsx")],
            // browser setup is in workspace
            browser: {
                provider: "playwright", // or 'webdriverio'
                enabled: isBrowserTest,
                name: "chromium", // browser name is required
                headless: true,
                viewport,
                providerOptions: {
                    context: {
                        recordVideo: {
                            dir: "./tests/browser/videos",
                            size: viewport,
                        },
                        viewport,
                        reducedMotion: "reduce",
                    },
                },
            },
        },
    };
});
