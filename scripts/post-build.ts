/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
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

const storeBaseUrl = () => {
    const destDir = path.resolve(__rootDir, "waldiez_studio", "static", "frontend");
    if (!fs.existsSync(destDir)) {
        throw new Error(`Destination directory does not exist: ${destDir}`);
    }
    const dstPath = path.resolve(destDir, "base_url.txt");
    if (fs.existsSync(dstPath)) {
        fs.unlinkSync(dstPath);
    }
    fs.writeFileSync(dstPath, "/");
};

const storePrefixes = () => {
    const destDir = path.resolve(__rootDir, "waldiez_studio", "static", "frontend");
    if (!fs.existsSync(destDir)) {
        throw new Error(`Destination directory does not exist: ${destDir}`);
    }
    const dstPath = path.resolve(destDir, "prefixes.json");
    if (fs.existsSync(dstPath)) {
        fs.unlinkSync(dstPath);
    }
    fs.writeFileSync(
        dstPath,
        JSON.stringify(
            {
                api: "__WALDIEZ_STUDIO_API__/api",
                ws: "__WALDIEZ_STUDIO_WS__/ws",
                vs: "__WALDIEZ_STUDIO_WS__/vs",
            },
            null,
            2,
        ),
    );
};

const main = () => {
    storeLastBuildDt();
    storeBaseUrl();
    storePrefixes();
};

main();
