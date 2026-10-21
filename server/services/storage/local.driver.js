/**
 * The local storage driver: processed images go to uploads/ (served by
 * server/app.js at /uploads) and originals to uploads-originals/ (never served).
 *
 * An image is addressed by its public URL, "/uploads/<name>". Only the base name of
 * a URL is ever turned into a path, so "/uploads/../server.js" cannot leave the folder.
 *
 * createLocalDriver takes the two folders, so the unit tests run on temporary ones;
 * the exported driver uses the real folders.
 */
const fs = require('fs');
const path = require('path');
const {
  saveOriginal, findOriginal, removeOriginal,
} = require('../../utils/originals');

const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'uploads');
const ORIGINALS_DIR = path.join(__dirname, '..', '..', '..', 'uploads-originals');
const URL_PREFIX = '/uploads/';

function createLocalDriver({ uploadsDir, originalsDir }) {
  fs.mkdirSync(uploadsDir, { recursive: true });

  /** Whether the URL points into the local uploads folder. */
  function owns(url) {
    return typeof url === 'string' && url.startsWith(URL_PREFIX);
  }

  /** The file inside the uploads folder that a URL points to. */
  const fileOf = (url) => path.join(uploadsDir, path.basename(url));

  /** Writes the processed image. An image with the same name (same content) is kept as is. */
  async function saveProcessed(name, buffer) {
    try {
      await fs.promises.writeFile(path.join(uploadsDir, path.basename(name)), buffer, { flag: 'wx' });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
    return URL_PREFIX + path.basename(name);
  }

  /** Keeps the original next to the processed name; the original is never served. */
  async function saveOriginalFile(name, buffer, ext) {
    saveOriginal(buffer, path.basename(name), ext, originalsDir);
  }

  /** The processed image's bytes, or null when the file is gone. */
  async function readProcessed(url) {
    try {
      return await fs.promises.readFile(fileOf(url));
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  /** The original's bytes and extension, or null when none was kept. */
  async function readOriginal(url) {
    const found = findOriginal(path.basename(url), originalsDir);
    if (!found) return null;
    return { buffer: await fs.promises.readFile(found), ext: path.extname(found) };
  }

  /** When the processed file was written, as { mtimeMs }, or null when it is gone. */
  async function statProcessed(url) {
    try {
      return { mtimeMs: (await fs.promises.stat(fileOf(url))).mtimeMs };
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  /** Deletes the processed file and its original. A file that is already gone is not an error. */
  async function remove(url) {
    await fs.promises.rm(fileOf(url), { force: true });
    removeOriginal(path.basename(url), originalsDir);
    return true;
  }

  return {
    name: 'local',
    owns,
    saveProcessed,
    saveOriginal: saveOriginalFile,
    readProcessed,
    readOriginal,
    statProcessed,
    remove,
  };
}

module.exports = {
  ...createLocalDriver({ uploadsDir: UPLOADS_DIR, originalsDir: ORIGINALS_DIR }),
  createLocalDriver,
  UPLOADS_DIR,
};
