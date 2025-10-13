/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import crypto from "crypto";
import fs from "fs-extra";
import https from "https";
import path from "path";
import tar from "tar-stream";
import url from "url";
import zlib from "zlib";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // <project>/scripts/
const __rootDir = path.resolve(__dirname, "..");

const FORCE = process.argv.includes("--force");
const REGISTRY_BASE_URL = "https://registry.npmjs.org";
const PACKAGE_NAME = "monaco-editor";
const TARGET_DIR = path.resolve(__rootDir, "waldiez_studio", "static", "monaco");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MONACO_DETAILS_PATH = path.join(TARGET_DIR, "monaco.json");
// 0.53.0 does not seem to play well with @monaco-editor/react
// let's check periodically and make it undefined when we are good.
const PINNED_VERSION: string | undefined = "0.54.0";

interface IPackageDetails {
    version: string;
    url: string;
    shaSum: string;
    last_check: string;
}

const readMonacoDetails = (): IPackageDetails | null => {
    if (!fs.existsSync(MONACO_DETAILS_PATH)) {
        return null;
    }

    try {
        const data = JSON.parse(fs.readFileSync(MONACO_DETAILS_PATH, "utf-8"));
        const lastCheck = new Date(data.last_check);
        if (Date.now() - lastCheck.getTime() >= ONE_DAY_MS) {
            return null;
        }
        const details = data as IPackageDetails;
        if (PINNED_VERSION && details.version !== PINNED_VERSION) {
            return null;
        }
        return details;
    } catch (err) {
        console.error("Error reading Monaco details:", err);
    }
    return null;
};

const fetchPackageDetails = async (): Promise<IPackageDetails> => {
    return new Promise((resolve, reject) => {
        const url = `${REGISTRY_BASE_URL}/${PACKAGE_NAME}`;
        https
            .get(url, res => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to fetch package details: ${res.statusCode}`));
                    return;
                }

                let data = "";
                res.on("data", chunk => (data += chunk));
                res.on("end", () => {
                    try {
                        const json = JSON.parse(data);
                        let version = json["dist-tags"].latest;
                        if (PINNED_VERSION && version !== PINNED_VERSION && PINNED_VERSION in json.versions) {
                            version = PINNED_VERSION;
                        }
                        const dist = json.versions[version].dist;
                        if (!version || !dist.tarball || !dist.shasum) {
                            reject(new Error("Incomplete package data."));
                            return;
                        }
                        const details: IPackageDetails = {
                            version,
                            url: dist.tarball,
                            shaSum: dist.shasum,
                            last_check: new Date().toISOString(),
                        };

                        fs.writeFileSync(MONACO_DETAILS_PATH, JSON.stringify(details, null, 2), "utf-8");
                        resolve(details);
                    } catch (err) {
                        console.error("Error parsing package details:", err);
                        reject(new Error("Error parsing package details."));
                    }
                });
            })
            .on("error", reject);
    });
};

const downloadFile = (url: string, dest: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https
            .get(url, res => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to download file: ${res.statusCode}`));
                    return;
                }
                res.pipe(file);
                res.on("end", () => {
                    file.close();
                    resolve();
                });
            })
            .on("error", reject);
    });
};

const validateChecksum = (filePath: string, expectedSha: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha1");
        const stream = fs.createReadStream(filePath);
        stream.on("data", chunk => hash.update(chunk));
        stream.on("end", () => {
            const actualSha = hash.digest("hex");
            if (actualSha !== expectedSha) {
                reject(new Error("SHA-1 checksum mismatch."));
            } else {
                resolve();
            }
        });
        stream.on("error", reject);
    });
};

// eslint-disable-next-line max-statements
const ensureMonacoFiles = async (): Promise<void> => {
    await fs.ensureDir(TARGET_DIR);

    const cached = readMonacoDetails();
    const details = cached || (await fetchPackageDetails());

    const loaderExists = fs.existsSync(path.join(TARGET_DIR, "vs", "loader.js"));

    if (!FORCE && cached && loaderExists) {
        console.info("Monaco Editor files are up-to-date.");
        return;
    }

    console.info("Downloading Monaco Editor tarball...");
    const tarballPath = path.join(TARGET_DIR, "monaco.tar.gz");

    try {
        await downloadFile(details.url, tarballPath);
        await validateChecksum(tarballPath, details.shaSum);
        await extractTarFile(tarballPath, TARGET_DIR);

        const monacoRoot = path.join(TARGET_DIR, "package");
        const vsSrc = path.join(monacoRoot, "min", "vs");
        const vsDst = path.join(TARGET_DIR, "vs");

        if (!fs.existsSync(vsSrc)) {
            throw new Error("vs/ directory not found after extraction.");
        }

        await fs.rm(vsDst, { recursive: true, force: true });
        await fs.rename(vsSrc, vsDst);

        const minMapsSrc = path.join(monacoRoot, "min-maps");
        const minMapsDst = path.join(TARGET_DIR, "min-maps");
        if (fs.existsSync(minMapsSrc)) {
            await fs.rm(minMapsDst, { recursive: true, force: true });
            await fs.rename(minMapsSrc, minMapsDst);
        }
        await fs.rm(monacoRoot, { recursive: true, force: true });

        console.info("Monaco Editor files updated.");
    } finally {
        if (fs.existsSync(tarballPath)) {
            await fs.rm(tarballPath);
        }
    }
};

const extractTarFile = async (file: string, dest: string): Promise<void> => {
    console.info("Extracting tar file...");
    return new Promise((resolve, reject) => {
        const extract = tar.extract();
        extract.on("entry", (header, stream, next) => {
            const filePath = path.join(dest, header.name);
            if (header.type === "file") {
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                stream.pipe(fs.createWriteStream(filePath));
            } else {
                fs.mkdirSync(filePath, { recursive: true });
            }
            stream.on("end", next);
            stream.resume();
        });
        extract.on("finish", resolve);
        extract.on("error", reject);

        fs.createReadStream(file).pipe(zlib.createGunzip()).pipe(extract);
    });
};

(async () => {
    try {
        await ensureMonacoFiles();
    } catch (err) {
        console.error("Failed to ensure Monaco Editor files:", err);
    }
})();
