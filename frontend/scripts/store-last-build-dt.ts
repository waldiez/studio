/*
    This script is used to store the last build date in the destination directory.
    This script is run after the build is complete.
*/
import fs from 'fs-extra';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const main = () => {
    const buildDt = new Date().toISOString();
    const destDir = path.resolve(__dirname, '..', '..', 'waldiez_studio', 'static', 'frontend');
    if (!fs.existsSync(destDir)) {
        throw new Error(`Destination directory does not exist: ${destDir}`);
    }
    const dstPath = path.resolve(destDir, 'last-build.txt');
    if (fs.existsSync(dstPath)) {
        fs.unlinkSync(dstPath);
    }
    fs.writeFileSync(dstPath, buildDt);
};

main();
