/**
 * Run python commands using the compatible python version.
 * If no virtual environment is found, it creates one.
 */
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// this dir: frontend/scripts
const __rootDir = path.resolve(__dirname, '..', '..');

const isWindows = process.platform === 'win32';
const possibleVenvNames = ['.venv', 'venv'];
const possiblePys = ['python', 'python3', 'python3.10', 'python3.11', 'python3.12'];

function isPyGte310lte313(pyCmd: string) {
    const pythonVersion = execSync(`${pyCmd} --version`).toString();
    const version = pythonVersion.split(' ')[1];
    const [major, minor] = version.split('.').map(x => parseInt(x, 10));
    if (major !== 3 || minor < 10 || minor >= 13) {
        return false;
    }
    return true;
}

function getCompatiblePythonExecutable() {
    let pyThonExec = null;
    for (const pyCmd of possiblePys) {
        try {
            execSync(`${pyCmd} --version`);
            if (isPyGte310lte313(pyCmd)) {
                pyThonExec = pyCmd;
                break;
            }
        } catch (_) {
            continue;
        }
    }
    return pyThonExec;
}

function getNewPythonExecutable() {
    console.info('No virtual environment found. Creating one...');
    const pyThonExec = getCompatiblePythonExecutable();
    if (!pyThonExec) {
        console.error('No compatible python found');
        process.exit(1);
    }
    const resolvedDir = path.resolve(__rootDir, possibleVenvNames[0]);
    execSync(`${pyThonExec} -m venv ${resolvedDir}`);
    const pythonPath = isWindows
        ? path.join(resolvedDir, 'Scripts', 'python.exe')
        : path.join(resolvedDir, 'bin', 'python');
    execSync(`${pythonPath} -m pip install --upgrade pip`);
    return pythonPath;
}

function getVenvPythonExecutable(venvDir: string) {
    const venvPythonPath = isWindows
        ? path.join(venvDir, 'Scripts', 'python.exe')
        : path.join(venvDir, 'bin', 'python');
    return venvPythonPath;
}

function getPythonExecutable() {
    let pythonPath = getCompatiblePythonExecutable();
    let found = false;
    for (const venvName of possibleVenvNames) {
        const venvDir = path.join(__rootDir, venvName);
        const venvPythonPath = getVenvPythonExecutable(venvDir);
        if (fs.existsSync(venvPythonPath)) {
            pythonPath = venvPythonPath;
            found = true;
            break;
        }
    }
    return found === true ? pythonPath : getNewPythonExecutable();
}

function showHelp() {
    console.info('\x1b[36mUsage: node --import=tsx scripts/python.[js,ts] <command>');
    console.info(
        '\x1b[36mExamples: \n' +
            'node --import=tsx scripts/python.ts -m pip install -r requirements/all.txt\n' +
            'bun scripts/python.ts path/to/file.py\n'
    );
    process.exit(0);
}

function main() {
    try {
        const cmd_args = process.argv.slice(2);
        if (cmd_args.length === 0 || cmd_args[0] === '-h' || cmd_args[0] === '--help') {
            showHelp();
        }
        const pythonExec = getPythonExecutable();
        const cmd_args_str = cmd_args.join(' ');
        execSync(`${pythonExec} ${cmd_args_str}`, { stdio: 'inherit' });
    } catch (err) {
        console.error('Error:', (err as Error).message);
        process.exit(1);
    }
}

main();
