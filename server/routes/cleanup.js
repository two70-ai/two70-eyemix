const express = require('express');
const { supabaseAdmin } = require('../services/supabase');
const { requireAdmin } = require('../middleware/auth');
const { listOldImages, deleteImages, extractFilenameFromUrl, BUCKETS } = require('../services/storage');

const router = express.Router();

// POST /api/cleanup — Delete images and records older than 30 days (admin only)
router.post('/', requireAdmin, async (req, res) => {
  const daysOld = parseInt(req.body.days_old) || 30;
  const results = {
    deleted_files: [],
    deleted_merges: 0,
    deleted_reference_images: 0,
    errors: [],
  };

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffISO = cutoffDate.toISOString();

    // Find old completed/failed merges
    const { data: oldMerges, error: mergesError } = await supabaseAdmin
      .from('merges')
      .select('id, iris_a_url, iris_b_url, result_image_url, status')
      .lt('created_at', cutoffISO)
      .in('status', ['completed', 'failed']);

    if (mergesError) {
      results.errors.push(`Failed to query old merges: ${mergesError.message}`);
    } else if (oldMerges && oldMerges.length > 0) {
      // Collect all storage filenames to delete
      const irisUploadsToDelete = [];
      const resultImagesToDelete = [];

      for (const merge of oldMerges) {
        if (merge.iris_a_url) {
          const filename = extractFilenameFromUrl(merge.iris_a_url, BUCKETS.IRIS_UPLOADS);
          if (filename) irisUploadsToDelete.push(filename);
        }
        if (merge.iris_b_url) {
          const filename = extractFilenameFromUrl(merge.iris_b_url, BUCKETS.IRIS_UPLOADS);
          if (filename) irisUploadsToDelete.push(filename);
        }
        if (merge.result_image_url) {
          const filename = extractFilenameFromUrl(merge.result_image_url, BUCKETS.GENERATED_RESULTS);
          if (filename) resultImagesToDelete.push(filename);
        }
      }

      // Delete from storage
      try {
        if (irisUploadsToDelete.length > 0) {
          await deleteImages(BUCKETS.IRIS_UPLOADS, irisUploadsToDelete);
          results.deleted_files.push(...irisUploadsToDelete.map((f) => `${BUCKETS.IRIS_UPLOADS}/${f}`));
        }
      } catch (err) {
        results.errors.push(`Iris uploads delete error: ${err.message}`);
      }

      try {
        if (resultImagesToDelete.length > 0) {
          await deleteImages(BUCKETS.GENERATED_RESULTS, resultImagesToDelete);
          results.deleted_files.push(...resultImagesToDelete.map((f) => `${BUCKETS.GENERATED_RESULTS}/${f}`));
        }
      } catch (err) {
        results.errors.push(`Result images delete error: ${err.message}`);
      }

      // Delete merge records from DB
      const mergeIds = oldMerges.map((m) => m.id);
      const { error: deleteMergesError } = await supabaseAdmin
        .from('merges')
        .delete()
        .in('id', mergeIds);

      if (deleteMergesError) {
        results.errors.push(`Failed to delete merge records: ${deleteMergesError.message}`);
      } else {
        results.deleted_merges = mergeIds.length;
      }
    }

    // Clean up old reference images from storage (not linked to DB records directly)
    try {
      const oldRefImages = await listOldImages(BUCKETS.REFERENCE_IMAGES, daysOld);
      if (oldRefImages.length > 0) {
        const refFilenames = oldRefImages.map((f) => f.name);
        await deleteImages(BUCKETS.REFERENCE_IMAGES, refFilenames);
        results.deleted_reference_images = refFilenames.length;
        results.deleted_files.push(...refFilenames.map((f) => `${BUCKETS.REFERENCE_IMAGES}/${f}`));
      }
    } catch (err) {
      results.errors.push(`Reference images cleanup error: ${err.message}`);
    }

    const status = results.errors.length > 0 ? 207 : 200;
    res.status(status).json({
      message: `Cleanup completed. Deleted ${results.deleted_merges} merge records and ${results.deleted_files.length} files.`,
      cutoff_date: cutoffISO,
      days_old: daysOld,
      results,
    });
  } catch (err) {
    console.error('Cleanup handler error:', err);
    res.status(500).json({ error: 'Cleanup failed', details: err.message });
  }
});

// GET /api/cleanup/stats — Preview what would be cleaned (admin only)
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const daysOld = parseInt(req.query.days_old) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffISO = cutoffDate.toISOString();

    const { count: oldMergesCount } = await supabaseAdmin
      .from('merges')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', cutoffISO);

    const { count: totalMergesCount } = await supabaseAdmin
      .from('merges')
      .select('*', { count: 'exact', head: true });

    res.json({
      cutoff_date: cutoffISO,
      days_old: daysOld,
      merges_to_delete: oldMergesCount || 0,
      total_merges: totalMergesCount || 0,
    });
  } catch (err) {
    console.error('Cleanup stats error:', err);
    res.status(500).json({ error: 'Failed to get cleanup stats' });
  }
});

module.exports = router;
