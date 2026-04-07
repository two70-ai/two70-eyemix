const fs = require('fs');
const path = require('path');

const BUCKETS = {
  IRIS_UPLOADS: 'iris-uploads',
  GENERATED_RESULTS: 'generated-results',
  REFERENCE_IMAGES: 'reference-images',
};

// STORAGE_LOCAL_BASE_DIR is only set during tests to redirect writes to a temp directory.
const BASE_DIR =
  process.env.STORAGE_LOCAL_BASE_DIR || path.resolve(__dirname, '../../data/storage');

/**
 * Create all bucket directories under ./data/storage/ if they don't already exist.
 * Safe to call repeatedly — mkdirSync with recursive:true is idempotent.
 */
async function ensureBucketsExist() {
  for (const bucketName of Object.values(BUCKETS)) {
    const dir = path.join(BASE_DIR, bucketName);
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write an image buffer to local storage and return a relative URL the Express
 * static route can serve.
 *
 * @param {string} bucket - One of the BUCKETS values
 * @param {string} filename - Filename or sub-path within the bucket (e.g. `{mergeId}/iris_a.jpg`)
 * @param {Buffer} buffer - Image data
 * @param {string} [contentType] - MIME type (unused for local; kept for interface parity)
 * @returns {Promise<string>} Relative URL: `/api/storage/{bucket}/{filename}`
 */
async function uploadImage(bucket, filename, buffer, contentType = 'image/jpeg') {
  const fullPath = path.join(BASE_DIR, bucket, filename);

  // Ensure any sub-directory within the bucket exists before writing.
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, buffer);

  return `/api/storage/${bucket}/${filename}`;
}

/**
 * Delete a single image from local storage.
 * Silently ignores ENOENT — a missing file is not an error.
 *
 * @param {string} bucket
 * @param {string} filename
 * @returns {Promise<void>}
 */
async function deleteImage(bucket, filename) {
  const fullPath = path.join(BASE_DIR, bucket, filename);
  try {
    fs.unlinkSync(fullPath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
 * Delete multiple images from local storage.
 * Per-file errors are collected and logged but do not abort the batch.
 *
 * @param {string} bucket
 * @param {string[]} filenames
 * @returns {Promise<void>}
 */
async function deleteImages(bucket, filenames) {
  if (!filenames || filenames.length === 0) return;

  const errors = [];
  for (const filename of filenames) {
    try {
      await deleteImage(bucket, filename);
    } catch (err) {
      errors.push({ filename, err });
    }
  }

  if (errors.length > 0) {
    for (const { filename, err } of errors) {
      console.error(`storageLocal: failed to delete ${bucket}/${filename}:`, err.message);
    }
  }
}

/**
 * Recursively collect all files under a directory.
 *
 * @param {string} dir - Absolute directory path to walk
 * @param {string} [relBase] - Relative base used to compute relative paths (defaults to `dir`)
 * @returns {{ absolutePath: string, relativePath: string }[]}
 */
function walkDir(dir, relBase) {
  const base = relBase !== undefined ? relBase : dir;
  let results = [];

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return results;
    throw err;
  }

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(absolutePath, base));
    } else {
      results.push({
        absolutePath,
        relativePath: path.relative(base, absolutePath),
      });
    }
  }

  return results;
}

/**
 * List files in a bucket that are older than `daysOld` days, including files
 * stored in sub-directories (e.g. `{mergeId}/iris_a.jpg`).
 *
 * @param {string} bucket
 * @param {number} [daysOld=30]
 * @returns {Promise<Array<{ name: string, created_at: string }>>}
 */
async function listOldImages(bucket, daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const bucketDir = path.join(BASE_DIR, bucket);
  const files = walkDir(bucketDir);

  const results = [];
  for (const { absolutePath, relativePath } of files) {
    let stat;
    try {
      stat = fs.statSync(absolutePath);
    } catch {
      // File disappeared between walk and stat — skip it.
      continue;
    }

    if (stat.mtime < cutoffDate) {
      results.push({
        name: relativePath,
        created_at: stat.mtime.toISOString(),
      });
    }
  }

  return results;
}

/**
 * Parse the filename from a local storage URL.
 * Handles both relative URLs (`/api/storage/{bucket}/{filename}`) and absolute
 * URLs with an origin prefix (`http://localhost:3000/api/storage/{bucket}/{filename}`).
 *
 * @param {string} url
 * @param {string} bucket
 * @returns {string} The filename/sub-path within the bucket, or '' on failure.
 */
function extractFilenameFromUrl(url, bucket) {
  if (!url || !bucket) return '';

  // Strip any leading origin so we work with the path portion only.
  let workingUrl = url;
  try {
    // If it parses as a full URL, take just the pathname.
    const parsed = new URL(url);
    workingUrl = parsed.pathname;
  } catch {
    // Already a relative path — use as-is.
  }

  const marker = `/api/storage/${bucket}/`;
  const idx = workingUrl.indexOf(marker);
  if (idx === -1) return '';

  return workingUrl.slice(idx + marker.length);
}

module.exports = {
  BUCKETS,
  uploadImage,
  deleteImage,
  deleteImages,
  listOldImages,
  extractFilenameFromUrl,
  ensureBucketsExist,
};
