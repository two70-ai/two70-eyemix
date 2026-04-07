const express = require('express');
const { merges, couples, promptTemplates, clientAccess } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { mergeValidation } = require('../utils/validation');
const { upload, handleUploadError } = require('../middleware/upload');
const nanoBanana = require('../services/nanoBanana');
const { uploadImage, BUCKETS } = require('../services/storageFactory');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// GET /api/merges — List merges
router.get('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'client') {
      // Get couples this client has unlocked access to
      const unlockedCoupleIds = await clientAccess.findUnlockedCoupleIdsByClient(req.user.id);

      if (unlockedCoupleIds.length === 0) {
        return res.json({ merges: [] });
      }

      const data = await merges.findAllByCoupleIds(unlockedCoupleIds);
      return res.json({ merges: data });
    }

    // Admin/staff: return all merges
    const data = await merges.findAll();
    res.json({ merges: data });
  } catch (err) {
    console.error('Merges list handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/merges — Create new merge
router.post(
  '/',
  requireAdmin,
  upload.fields([
    { name: 'iris_a', maxCount: 1 },
    { name: 'iris_b', maxCount: 1 },
  ]),
  handleUploadError,
  mergeValidation.create,
  async (req, res) => {
    try {
      const { couple_id, template_id } = req.body;
      const files = req.files;

      if (!files?.iris_a?.[0] || !files?.iris_b?.[0]) {
        return res.status(400).json({ error: 'Both iris_a and iris_b images are required' });
      }

      const irisAFile = files.iris_a[0];
      const irisBFile = files.iris_b[0];

      // Verify couple exists
      const couple = await couples.findByIdSimple(couple_id);

      if (!couple) {
        return res.status(404).json({ error: 'Couple not found' });
      }

      // Verify template exists and is active
      const template = await promptTemplates.findByIdActive(template_id);

      if (!template) {
        return res.status(404).json({ error: 'Template not found or inactive' });
      }

      // Upload both iris images to storage
      const mergeId = uuidv4();
      const irisAFilename = `${mergeId}/iris_a_${Date.now()}.jpg`;
      const irisBFilename = `${mergeId}/iris_b_${Date.now()}.jpg`;

      let irisAUrl, irisBUrl;
      try {
        [irisAUrl, irisBUrl] = await Promise.all([
          uploadImage(BUCKETS.IRIS_UPLOADS, irisAFilename, irisAFile.buffer, irisAFile.mimetype),
          uploadImage(BUCKETS.IRIS_UPLOADS, irisBFilename, irisBFile.buffer, irisBFile.mimetype),
        ]);
      } catch (uploadErr) {
        console.error('Iris upload error:', uploadErr);
        return res.status(500).json({ error: 'Failed to upload iris images' });
      }

      // Build the full prompt
      const fullPrompt = nanoBanana.buildIrisPrompt(template.prompt_text);

      // Create merge record with pending status
      const merge = await merges.create({
        id: mergeId,
        couple_id,
        template_id,
        iris_a_url: irisAUrl,
        iris_b_url: irisBUrl,
        prompt_used: fullPrompt,
        status: 'pending',
        created_by: req.user.id,
      });

      // Call NanoBanana AI to generate merged iris
      let resultImageBuffer;
      try {
        resultImageBuffer = await nanoBanana.generateImage(fullPrompt, [
          { buffer: irisAFile.buffer, mimeType: irisAFile.mimetype },
          { buffer: irisBFile.buffer, mimeType: irisBFile.mimetype },
        ]);
      } catch (genError) {
        console.error('NanoBanana generation error:', genError);
        // Update merge status to failed
        await merges.update(mergeId, { status: 'failed' });
        return res.status(502).json({ error: `AI generation failed: ${genError.message}` });
      }

      // Upload result to generated-results bucket
      const resultFilename = `${mergeId}/result_${Date.now()}.png`;
      let resultUrl;
      try {
        resultUrl = await uploadImage(BUCKETS.GENERATED_RESULTS, resultFilename, resultImageBuffer, 'image/png');
      } catch (uploadErr) {
        console.error('Result upload error:', uploadErr);
        await merges.update(mergeId, { status: 'failed' });
        return res.status(500).json({ error: 'Failed to store result image' });
      }

      // Update merge record with result
      const updatedMerge = await merges.updateWithJoins(mergeId, {
        result_image_url: resultUrl,
        status: 'completed',
      });

      res.status(201).json({ merge: updatedMerge });
    } catch (err) {
      console.error('Merge create handler error:', err);
      res.status(500).json({ error: 'Server error during merge creation' });
    }
  }
);

// GET /api/merges/:id — Get merge detail
router.get('/:id', requireAuth, mergeValidation.idParam, async (req, res) => {
  try {
    const { id } = req.params;

    const merge = await merges.findById(id);

    if (!merge) {
      return res.status(404).json({ error: 'Merge not found' });
    }

    // Client access check
    if (req.user.role === 'client') {
      const access = await clientAccess.findByClientAndCouple(req.user.id, merge.couple_id);

      if (!access) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!access.paywall_unlocked) {
        return res.status(402).json({ error: 'Paywall locked. Please unlock to view results.' });
      }
    }

    res.json({ merge });
  } catch (err) {
    console.error('Merge detail handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/merges/:id — Delete merge (admin only)
router.delete('/:id', requireAdmin, mergeValidation.idParam, async (req, res) => {
  try {
    const { id } = req.params;

    await merges.delete(id);

    res.json({ message: 'Merge deleted successfully' });
  } catch (err) {
    console.error('Merge delete handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
