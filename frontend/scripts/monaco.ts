// ensure monaco loader files are present in the public folder (public/vs)
import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import path from 'path';
import tar from 'tar-stream';
import url from 'url';
import zlib from 'zlib';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGISTRY_BASE_URL = 'https://registry.npmjs.org';
const PACKAGE_NAME = 'monaco-editor';
const PUBLIC_PATH = path.resolve(__dirname, '..', '..', 'public');

function checkShaSum(file: string, shaSum: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(file);
    stream.on('data', chunk => {
      hash.update(chunk);
    });
    stream.on('end', () => {
      const fileShaSum = hash.digest('hex');
      resolve(fileShaSum === shaSum);
    });
    stream.on('error', err => {
      reject(err);
    });
  });
}

function extractTarFile(file: string, dest: string): Promise<void> {
  console.info('Extracting tar file...');
  return new Promise((resolve, reject) => {
    const extract = tar.extract();
    extract.on('entry', (header, stream, next) => {
      const filePath = path.join(dest, header.name);
      if (header.type === 'file') {
        // make sure the directory exists
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        stream.pipe(fs.createWriteStream(filePath));
      } else {
        fs.mkdirSync(filePath, { recursive: true });
      }
      stream.on('end', () => {
        next();
      });
      stream.resume();
    });
    extract.on('finish', () => {
      resolve();
    });
    extract.on('error', err => {
      reject(err);
    });
    fs.createReadStream(file).pipe(zlib.createGunzip()).pipe(extract);
  });
}

function keepOnlyMinVs(dir: string): void {
  const packageDir = path.join(dir, 'package');
  const minVsDir = path.join(packageDir, 'min', 'vs');
  const destDir = path.join(dir, 'vs');
  if (fs.existsSync(minVsDir)) {
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true });
    }
    fs.renameSync(minVsDir, destDir);
    fs.rmSync(packageDir, { recursive: true });
  }
}

function findLatestVersion(): Promise<[string, string, string]> {
  return new Promise((resolve, reject) => {
    https
      .get(`${REGISTRY_BASE_URL}/${PACKAGE_NAME}`, res => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          const json = JSON.parse(data);
          const latestVersion = json['dist-tags']['latest'];
          const latestVersionData = json['versions'][latestVersion];
          const url = latestVersionData['dist']['tarball'];
          const shaSum = latestVersionData['dist']['shasum'];
          resolve([latestVersion, url, shaSum]);
        });
      })
      .on('error', err => {
        reject(err);
      });
  });
}

function handleDownload(
  tempDir: string,
  tempFile: string,
  publicPath: string,
  shaSum: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    checkShaSum(tempFile, shaSum)
      .then(isValid => {
        if (isValid) {
          extractTarFile(tempFile, publicPath)
            .then(() => {
              keepOnlyMinVs(publicPath);
              fs.unlinkSync(tempFile);
              fs.rmSync(tempDir, {
                recursive: true
              });
              resolve();
            })
            .catch(err => {
              reject(err);
            });
        } else {
          reject(new Error('Invalid sha sum'));
        }
      })
      .catch(err => {
        reject(err);
      });
  });
}

function downloadMonacoEditor(version: [string, string, string], publicPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const [_, url, shaSum] = version;
    const tempDir = path.join(publicPath, 'temp');
    const tempFile = path.join(tempDir, 'monaco-editor.tgz');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const file = fs.createWriteStream(tempFile);
    https
      .get(url, res => {
        res.pipe(file);
        res.on('end', () => {
          file.close();
          handleDownload(tempDir, tempFile, publicPath, shaSum)
            .then(() => {
              resolve();
            })
            .catch(err => {
              reject(err);
            });
        });
      })
      .on('error', err => {
        reject(err);
      });
  });
}

function ensureMonacoFiles(publicPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    findLatestVersion()
      .then(versionInfo => {
        const latestVersion = versionInfo[0];
        const versionFile = path.join(publicPath, 'monaco_latest_version');
        let currentVersion = '';
        if (fs.existsSync(versionFile)) {
          currentVersion = fs.readFileSync(versionFile, 'utf-8');
        }
        const loaderJs = path.join(publicPath, 'vs', 'loader.js');
        if (currentVersion !== latestVersion || !fs.existsSync(loaderJs)) {
          console.info('Downloading monaco editor files...');
          downloadMonacoEditor(versionInfo, publicPath)
            .then(() => {
              fs.writeFileSync(versionFile, latestVersion, 'utf-8');
              resolve();
            })
            .catch(err => {
              reject(err);
            });
        } else {
          resolve();
        }
      })
      .catch(err => {
        reject(err);
      });
  });
}

function main() {
  ensureMonacoFiles(PUBLIC_PATH)
    .then(() => {
      // console.info('Monaco editor files are up-to-date.');
      process.exit(0);
    })
    .catch(err => {
      throw err;
    });
}

main();
