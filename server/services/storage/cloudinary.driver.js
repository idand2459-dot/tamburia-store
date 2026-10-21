/**
 * The Cloudinary storage driver: processed images are public assets, originals are
 * private assets that only a signed download URL can read.
 *
 * An image is addressed by its public URL,
 * "https://res.cloudinary.com/<cloud>/image/upload/products/<name>". The asset's public
 * id is the file's base name (a content hash for admin uploads), so the same bytes land
 * on the same asset and an upload is idempotent (overwrite: false).
 *
 * The SDK and the HTTP client are injected, so the unit tests run with no network and
 * no account. createCloudinaryDriver is the testable core; the real SDK is wired in
 * index.js.
 */
const path = require('path');

const PUBLIC_FOLDER = 'products';
const ORIGINALS_FOLDER = 'originals';
const DOWNLOAD_TTL_SECONDS = 300;

/**
 * Splits CLOUDINARY_URL ("cloudinary://<key>:<secret>@<cloud>") into SDK settings.
 * The errors never print the value: it carries the API secret.
 */
function parseCloudinaryUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('CLOUDINARY_URL is not a valid URL');
  }
  if (url.protocol !== 'cloudinary:' || !url.hostname || !url.username || !url.password) {
    throw new Error('CLOUDINARY_URL must look like cloudinary://<key>:<secret>@<cloud>');
  }
  return {
    cloud_name: url.hostname,
    api_key: decodeURIComponent(url.username),
    api_secret: decodeURIComponent(url.password),
    secure: true,
  };
}

/** The base name of an asset, without its extension: "0b99d097208f5e91.webp" -> "0b99d097208f5e91". */
function baseOf(name) {
  return path.basename(name, path.extname(name));
}

/** Rejects names that could not be an asset id, before they reach the API. */
function assertSafeBase(base) {
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(base)) throw new Error(`unsafe image name: ${base}`);
  return base;
}

/** Escapes a string for use inside a regular expression. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {object} deps
 * @param {object} deps.sdk        the Cloudinary v2 SDK, already configured
 * @param {string} deps.cloudName  the cloud's name, as in the public URLs
 * @param {Function} [deps.fetchImpl]  fetch, for reading private originals
 */
function createCloudinaryDriver({ sdk, cloudName, fetchImpl = fetch }) {
  const publicPrefix = `https://res.cloudinary.com/${cloudName}/image/upload/`;
  // An optional version segment ("v1700000000/") is accepted: URLs copied from the dashboard carry it.
  const urlPattern = new RegExp(
    `^${escapeRegExp(publicPrefix)}(?:v\\d+/)?${PUBLIC_FOLDER}/([A-Za-z0-9._-]+)\\.[A-Za-z0-9]+$`,
  );

  /** The asset base name behind a public URL of this cloud, or null for any other URL. */
  function baseOfUrl(url) {
    if (typeof url !== 'string') return null;
    const match = urlPattern.exec(url.split('?')[0]);
    return match ? match[1] : null;
  }

  const owns = (url) => baseOfUrl(url) !== null;

  /** Sends bytes to the SDK's upload stream and resolves with the API result. */
  function upload(buffer, options) {
    return new Promise((resolve, reject) => {
      const stream = sdk.uploader.upload_stream(options, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
      stream.end(buffer);
    });
  }

  /** Uploads the processed WebP as a public asset and returns its public URL. */
  async function saveProcessed(name, buffer) {
    const base = assertSafeBase(baseOf(name));
    await upload(buffer, {
      public_id: `${PUBLIC_FOLDER}/${base}`,
      resource_type: 'image',
      type: 'upload',
      overwrite: false,
    });
    return `${publicPrefix}${PUBLIC_FOLDER}/${base}.webp`;
  }

  /** Uploads the original as a private asset: no public URL exists for it. */
  async function saveOriginal(name, buffer) {
    const base = assertSafeBase(baseOf(name));
    await upload(buffer, {
      public_id: `${ORIGINALS_FOLDER}/${base}`,
      resource_type: 'image',
      type: 'private',
      overwrite: false,
    });
  }

  /** Downloads a URL's bytes; null on 404. */
  async function download(url) {
    const res = await fetchImpl(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`download failed with ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async function readProcessed(url) {
    return baseOfUrl(url) === null ? null : download(url.split('?')[0]);
  }

  /** The original's bytes and extension, read through a short-lived signed URL; null when none exists. */
  async function readOriginal(url) {
    const base = baseOfUrl(url);
    if (base === null) return null;
    const publicId = `${ORIGINALS_FOLDER}/${base}`;

    let resource;
    try {
      resource = await sdk.api.resource(publicId, { type: 'private', resource_type: 'image' });
    } catch (err) {
      if (err && (err.http_code === 404 || err.error?.http_code === 404)) return null;
      throw err;
    }

    const signed = sdk.utils.private_download_url(publicId, resource.format, {
      type: 'private',
      resource_type: 'image',
      expires_at: Math.floor(Date.now() / 1000) + DOWNLOAD_TTL_SECONDS,
    });
    const buffer = await download(signed);
    return buffer ? { buffer, ext: `.${resource.format}` } : null;
  }

  /** When the public asset was created, as { mtimeMs }, or null when it does not exist. One API call. */
  async function statProcessed(url) {
    const base = baseOfUrl(url);
    if (base === null) return null;
    try {
      const resource = await sdk.api.resource(`${PUBLIC_FOLDER}/${base}`, { type: 'upload', resource_type: 'image' });
      return { mtimeMs: Date.parse(resource.created_at) };
    } catch (err) {
      if (err && (err.http_code === 404 || err.error?.http_code === 404)) return null;
      throw err;
    }
  }

  /** Deletes the public asset and the private original. An asset that is already gone is not an error. */
  async function remove(url) {
    const base = baseOfUrl(url);
    if (base === null) return false;
    await sdk.uploader.destroy(`${PUBLIC_FOLDER}/${base}`, { type: 'upload', resource_type: 'image', invalidate: true });
    await sdk.uploader.destroy(`${ORIGINALS_FOLDER}/${base}`, { type: 'private', resource_type: 'image' });
    return true;
  }

  return {
    name: 'cloudinary', owns, saveProcessed, saveOriginal, readProcessed, readOriginal, statProcessed, remove,
  };
}

module.exports = {
  createCloudinaryDriver, parseCloudinaryUrl, PUBLIC_FOLDER, ORIGINALS_FOLDER,
};
