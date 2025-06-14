/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";
import url from "url";

import packageJson from "../../package.json";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __rootDir = path.resolve(__dirname, "..", "..");

const getPackageManager = (): string => {
    const ifNotFound = "yarn";
    const packageManager = packageJson.packageManager || ifNotFound;
    return packageManager.split("@")[0];
};

const main = () => {
    const lcovPath = path.resolve(__dirname, "..", "..", "coverage", "lcov.info");
    if (!fs.existsSync(lcovPath)) {
        console.info("No lcov.info found. Skipping HTML report generation");
        return;
    }
    execSync(`${getPackageManager()} run lcov:html`, {
        stdio: "inherit",
        cwd: __rootDir,
    });
};

main();
