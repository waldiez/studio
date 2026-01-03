/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import { execFileSync } from "child_process";
import fs from "fs-extra";
import path from "path";
import url from "url";

import packageJson from "../package.json";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __rootDir = path.resolve(__dirname, "..");

const getPackageManager = (): string => {
    let ifNotFound = "yarn";
    if (fs.existsSync("bun.lockb") || fs.existsSync("bun.lock")) {
        ifNotFound = "bun";
    } else {
        if (fs.existsSync("pnpm-lock.yaml")) {
            ifNotFound = "pnpm";
        } else {
            if (fs.existsSync("yarn.lock")) {
                ifNotFound = "yarn";
            }
        }
    }
    const packageManager = packageJson.packageManager || ifNotFound;
    return packageManager.split("@")[0];
};

const runScript = (script: string, opts?: { cwd?: string }) => {
    const pm = getPackageManager();
    const cwd = opts?.cwd ?? __rootDir;

    const args =
        pm === "bun"
            ? ["run", script]
            : pm === "pnpm"
              ? ["-s", "run", script]
              : pm === "yarn"
                ? ["-s", script]
                : ["run", "-s", script]; // npm
    execFileSync(pm, args, { stdio: "inherit", cwd });
};

const main = () => {
    const lcovPath = path.resolve(__rootDir, "coverage", "lcov.info");
    if (!fs.existsSync(lcovPath)) {
        console.info("No lcov.info found. Skipping HTML report generation");
        return;
    }
    runScript("lcov:html");
};

main();
