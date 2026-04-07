/**
 * Storage factory — returns the correct storage adapter based on DB_SOURCE.
 *
 * DB_SOURCE=sqlite  → local filesystem adapter (storageLocal.js)
 * anything else     → Supabase Storage adapter (storage.js)
 *
 * Both adapters expose the same interface:
 *   BUCKETS, uploadImage, deleteImage, deleteImages,
 *   listOldImages, extractFilenameFromUrl, ensureBucketsExist
 */

const adapter =
  process.env.DB_SOURCE === 'sqlite'
    ? require('./storageLocal')
    : require('./storage');

module.exports = adapter;
