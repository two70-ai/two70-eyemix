const { supabaseAdmin } = require('./supabase');

const BUCKETS = {
  IRIS_UPLOADS: 'iris-uploads',
  GENERATED_RESULTS: 'generated-results',
  REFERENCE_IMAGES: 'reference-images',
};

/**
 * Upload an image to Supabase Storage
 * @param {string} bucket - Bucket name
 * @param {string} filename - Filename/path within bucket
 * @param {Buffer} buffer - Image buffer
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} Public URL of uploaded image
 */
async function uploadImage(bucket, filename, buffer, contentType = 'image/jpeg') {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filename, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(filename);

  return urlData.publicUrl;
}

/**
 * Delete an image from Supabase Storage
 * @param {string} bucket - Bucket name
 * @param {string} filename - Filename/path within bucket
 * @returns {Promise<void>}
 */
async function deleteImage(bucket, filename) {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .remove([filename]);

  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

/**
 * Delete multiple images from Supabase Storage
 * @param {string} bucket - Bucket name
 * @param {string[]} filenames - Array of filenames/paths
 * @returns {Promise<void>}
 */
async function deleteImages(bucket, filenames) {
  if (!filenames || filenames.length === 0) return;

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .remove(filenames);

  if (error) {
    throw new Error(`Storage bulk delete failed: ${error.message}`);
  }
}

/**
 * List images in a bucket older than N days
 * @param {string} bucket - Bucket name
 * @param {number} daysOld - Age threshold in days
 * @returns {Promise<Array>} Array of file objects
 */
async function listOldImages(bucket, daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .list('', {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'asc' },
    });

  if (error) {
    throw new Error(`Storage list failed for bucket ${bucket}: ${error.message}`);
  }

  if (!data) return [];

  // Filter files older than cutoff date
  return data.filter((file) => {
    if (!file.created_at) return false;
    const fileDate = new Date(file.created_at);
    return fileDate < cutoffDate;
  });
}

/**
 * Extract filename from a Supabase Storage public URL
 * @param {string} url - Full public URL
 * @param {string} bucket - Bucket name to strip from path
 * @returns {string} Filename/path within the bucket
 */
function extractFilenameFromUrl(url, bucket) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split(`/storage/v1/object/public/${bucket}/`);
    return pathParts[1] || '';
  } catch {
    return '';
  }
}

/**
 * Ensure all required storage buckets exist (creates them if missing)
 * Call this during server startup
 */
async function ensureBucketsExist() {
  const bucketsToCreate = Object.values(BUCKETS);

  for (const bucketName of bucketsToCreate) {
    const { data: existing, error: listError } = await supabaseAdmin.storage.getBucket(bucketName);

    if (listError && listError.message?.includes('not found')) {
      const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
      });

      if (createError) {
        console.warn(`Could not create bucket ${bucketName}: ${createError.message}`);
      } else {
        console.log(`Created storage bucket: ${bucketName}`);
      }
    }
  }
}

module.exports = {
  uploadImage,
  deleteImage,
  deleteImages,
  listOldImages,
  extractFilenameFromUrl,
  ensureBucketsExist,
  BUCKETS,
};
