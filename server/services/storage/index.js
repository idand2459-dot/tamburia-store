/**
 * Where product images live: one interface over the local disk and Cloudinary.
 *
 * STORAGE_DRIVER chooses where new images go. Reading and deleting follow the URL
 * instead: an image is handled by whichever driver owns its URL, so a "/uploads/..."
 * URL still works after the switch and a Cloudinary URL works on a local run.
 *
 * Every function is async, even for the local driver, so callers do not care which
 * one is active.
 */
const config = require('../../config/env');
const local = require('./local.driver');
const { createCloudinaryDriver, parseCloudinaryUrl } = require('./cloudinary.driver');

let cloudinary = null;

/** The Cloudinary driver, built on first use from CLOUDINARY_URL (the SDK is loaded only then). */
function cloudinaryDriver() {
  if (!cloudinary) {
    const settings = parseCloudinaryUrl(config.storage.cloudinaryUrl);
    const { v2: sdk } = require('cloudinary');
    sdk.config(settings);
    cloudinary = createCloudinaryDriver({ sdk, cloudName: settings.cloud_name });
  }
  return cloudinary;
}

/** The driver that receives new images. */
function active() {
  return config.storage.driver === 'cloudinary' ? cloudinaryDriver() : local;
}

/** The driver that owns an image URL, or null for a URL this app does not manage. */
function driverFor(url) {
  if (local.owns(url)) return local;
  if (config.storage.cloudinaryUrl) {
    const driver = cloudinaryDriver();
    if (driver.owns(url)) return driver;
  }
  return null;
}

/** Stores a processed image under a name; returns its public URL. */
const saveProcessed = (name, buffer) => active().saveProcessed(name, buffer);

/** Stores the untouched upload next to it; never publicly readable. */
const saveOriginal = (name, buffer, ext) => active().saveOriginal(name, buffer, ext);

/** Whether the app stores this URL (and so may delete it). */
const isManaged = (url) => driverFor(url) !== null;

/** The processed image's bytes, or null. */
const readProcessed = (url) => {
  const driver = driverFor(url);
  return driver ? driver.readProcessed(url) : Promise.resolve(null);
};

/** The original's { buffer, ext }, or null. */
const readOriginal = (url) => {
  const driver = driverFor(url);
  return driver ? driver.readOriginal(url) : Promise.resolve(null);
};

/** Deletes an image and its original through the driver that owns the URL. Returns whether it did. */
const remove = (url) => {
  const driver = driverFor(url);
  return driver ? driver.remove(url) : Promise.resolve(false);
};

module.exports = {
  saveProcessed,
  saveOriginal,
  isManaged,
  readProcessed,
  readOriginal,
  remove,
  driverFor,
  UPLOADS_DIR: local.UPLOADS_DIR,
};
