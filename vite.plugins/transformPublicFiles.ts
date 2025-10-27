/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import fs from "fs-extra";
import { glob } from "glob";
import path from "path";
import { type Plugin } from "vite";

export const transformPublicFiles = (distPath: string, replacement: string): Plugin => {
    const fileExtensions = [".webmanifest", ".json", ".xml", ".txt"];
    return {
        name: "transform-public-files",
        // apply: "build",
        enforce: "post",
        // Server-level hook for development
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url && fileExtensions.some(ext => req.url?.endsWith(ext))) {
                    const filePath = path.join("public", req.url);
                    if (fs.existsSync(filePath)) {
                        let content = fs.readFileSync(filePath, "utf-8");
                        content = content.replace(/%BASE_URL%/g, replacement);
                        if (req.url.endsWith(".webmanifest") || req.url.endsWith(".json")) {
                            res.setHeader("Content-Type", "application/json");
                            if (req.url.endsWith(".webmanifest")) {
                                const manifest = JSON.parse(content);
                                if (manifest.start_url) {
                                    // Remove /frontend/ from the start_url if present
                                    manifest.start_url = manifest.start_url.replace(/\/frontend\//g, "/");
                                }
                                content = JSON.stringify(manifest, null, 2) + "\n";
                            }
                        } else if (req.url.endsWith(".xml")) {
                            res.setHeader("Content-Type", "application/xml");
                        }
                        res.end(content);
                        return;
                    }
                }
                next();
            });
        },
        generateBundle() {
            const filesToProcess = glob.sync(`${distPath}/*.{webmanifest,json,xml,txt}`);
            filesToProcess.forEach(filePath => {
                if (fs.existsSync(filePath)) {
                    let content = fs.readFileSync(filePath, "utf-8");
                    if (content.includes("%BASE_URL%")) {
                        content = content.replace(/%BASE_URL%/g, replacement);
                        if (filePath.endsWith(".webmanifest")) {
                            const manifest = JSON.parse(content);
                            if (manifest.start_url) {
                                // Remove /frontend/ from the start_url if present
                                manifest.start_url = manifest.start_url.replace(/\/frontend\//g, "/");
                            }
                            content = JSON.stringify(manifest, null, 2) + "\n";
                        }
                        // Emit as asset
                        this.emitFile({
                            type: "asset",
                            fileName: path.basename(filePath),
                            source: content,
                        });
                    }
                }
            });
        },
    };
};
