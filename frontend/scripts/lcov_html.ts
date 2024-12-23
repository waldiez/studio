/**
 * Generate HTML coverage report from lcov.info
 * Only if lcov.info exists
 */
import packageJson from "../../package.json";
import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";
import url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __rootDir = path.resolve(__dirname, "..", "..");

function getPackageManager() {
    const ifNotFound = "yarn";
    return packageJson.packageManager || ifNotFound;
}

const main = () => {
    const lcovPath = path.resolve(__dirname, "..", "..", "coverage", "lcov.info");
    if (!fs.existsSync(lcovPath)) {
        console.info("No lcov.info found. Skipping HTML report generation");
        process.exit(0);
    }
    execSync(`${getPackageManager()} run lcov:html`, { stdio: "inherit", cwd: __rootDir });
};

main();
