/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import fs from "fs-extra";
import path from "path";
import url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // <project>/scripts/
const __rootDir = path.resolve(__dirname, "..");

const storeLastBuildDt = () => {
    const buildDt = new Date().toISOString();
    const destDir = path.resolve(__rootDir, "waldiez_studio", "static", "frontend");
    if (!fs.existsSync(destDir)) {
        throw new Error(`Destination directory does not exist: ${destDir}`);
    }
    const dstPath = path.resolve(destDir, "last-build.txt");
    if (fs.existsSync(dstPath)) {
        fs.unlinkSync(dstPath);
    }
    fs.writeFileSync(dstPath, buildDt);
};

const main = () => {
    storeLastBuildDt();
};

main();
