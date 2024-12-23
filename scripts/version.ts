/* handle version updates

if `--get` is passed, return the current version (x.y.z format)
if `--set` is passed, set the version to the value of the next argument
if `--set` validate that it is a valid version(x.y.z format)
*/
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function showHelp(status: number = 1): void {
    console.log("Usage: node --import=tsx|bun version.ts [--get | --set <version>]");
    process.exit(status);
}

function validateArgs(): void {
    if (process.argv.length < 3) {
        console.error("Error: No arguments provided");
        showHelp();
    }
    const action = process.argv[2];
    if (action !== "--get" && action !== "--set") {
        console.error("Error: Invalid action provided");
        showHelp();
    }
    if (process.argv.length < 4 && process.argv[2] === "--set") {
        console.error("Error: No version provided");
        showHelp();
    }
    if (process.argv.length > 4) {
        console.error("Error: Too many arguments provided");
        showHelp();
    }
    if (process.argv[2] === "--set") {
        const version = process.argv[3];
        if (!/^\d+\.\d+\.\d+$/.test(version)) {
            console.error("Error: Invalid version provided");
            showHelp();
        }
    }
}

function getVersion(): string {
    const packageJsonPath = path.join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return packageJson.version;
}

function setVersion(version: string): void {
    const packageJsonPath = path.join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    packageJson.version = version;
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4));
    let gotWaldiez = false;
    Object.keys(packageJson.dependencies).forEach(dependency => {
        if (dependency.startsWith("@waldiez/react")) {
            gotWaldiez = true;
            packageJson.dependencies[dependency] = `^${version}`;
        }
    });
    if (!gotWaldiez) {
        console.error("Error: @waldiez/react not found in dependencies");
        process.exit(1);
    }
    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 4)}\n`, { encoding: "utf8" });
    // the new version might not be available in the registry yet
    // execSync("bun install", { stdio: "inherit", cwd: path.join(__dirname, "..") });
}

function main(): void {
    validateArgs();
    const action = process.argv[2];
    if (action === "--get") {
        console.log(getVersion());
    } else if (action === "--set") {
        setVersion(process.argv[3]);
    }
}

main();
