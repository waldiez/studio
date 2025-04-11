/* eslint-disable max-statements */
import crypto from "crypto";
import fs from "fs-extra";
import https from "https";
import path from "path";
import tar from "tar-stream";
import url from "url";
import zlib from "zlib";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGISTRY_BASE_URL = "https://registry.npmjs.org";
const PACKAGE_NAME = "monaco-editor";
const PUBLIC_PATH = path.resolve(__dirname, "..", "..", "public");

const MONACO_DETAILS_PATH = path.join(PUBLIC_PATH, "monaco_details.json");

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
        if (Date.now() - lastCheck.getTime() < 24 * 60 * 60 * 1000) {
            return data as IPackageDetails;
        }
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
                        const packageData = JSON.parse(data);
                        const latestVersion = packageData["dist-tags"].latest;
                        const versionInfo = packageData.versions[latestVersion];
                        const tarballUrl = versionInfo.dist.tarball;
                        const shaSum = versionInfo.dist.shasum;

                        if (!latestVersion || !tarballUrl || !shaSum) {
                            reject(new Error("Incomplete package details."));
                            return;
                        }

                        const details: IPackageDetails = {
                            version: latestVersion,
                            url: tarballUrl,
                            shaSum,
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

const ensureMonacoFiles = async (): Promise<void> => {
    const cachedDetails = readMonacoDetails();
    const details = cachedDetails || (await fetchPackageDetails());
    const monacoPath = path.join(PUBLIC_PATH);
    const tarballPath = path.join(PUBLIC_PATH, "monaco.tar.gz");

    if (fs.existsSync(path.join(monacoPath, "vs", "loader.js"))) {
        return;
    }

    console.info("Downloading Monaco Editor tarball...");
    await downloadFile(details.url, tarballPath);

    const calculatedShaSum = crypto.createHash("sha1").update(fs.readFileSync(tarballPath)).digest("hex");

    if (calculatedShaSum !== details.shaSum) {
        throw new Error("SHA-1 checksum mismatch.");
    }

    await extractTarFile(tarballPath, monacoPath);

    const monacoEditorRoot = path.join(monacoPath, "package");
    const vsSrc = path.join(monacoEditorRoot, "min", "vs");
    const vsDst = path.join(PUBLIC_PATH, "vs");

    if (!fs.existsSync(vsSrc)) {
        throw new Error("Failed to extract Monaco editor files.");
    }

    fs.rmSync(vsDst, { recursive: true, force: true });
    fs.renameSync(vsSrc, vsDst);

    const minMapsSrc = path.join(monacoEditorRoot, "min-maps");
    if (fs.existsSync(minMapsSrc)) {
        const minMapsDst = path.join(PUBLIC_PATH, "min-maps");
        fs.rmSync(minMapsDst, { recursive: true, force: true });
        fs.renameSync(minMapsSrc, minMapsDst);
    }
    return new Promise((resolve, reject) => {
        fs.promises
            .rm(monacoEditorRoot, { recursive: true })
            .then(() => {
                console.info("Monaco Editor files are up-to-date.");
                resolve();
            })
            .catch(err => {
                if (fs.existsSync(MONACO_DETAILS_PATH)) {
                    fs.rmSync(MONACO_DETAILS_PATH);
                }
                reject(err);
            })
            .finally(() => {
                if (fs.existsSync(tarballPath)) {
                    fs.rmSync(tarballPath);
                }
            });
    });
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
