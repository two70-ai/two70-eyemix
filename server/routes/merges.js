const express = require('express');
const { supabaseAdmin } = require('../services/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { mergeValidation } = require('../utils/validation');
const { upload, handleUploadError } = require('../middleware/upload');
const nanoBanana = require('../services/nanoBanana');
const { uploadImage, BUCKETS } = require('../services/storage');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// GET /api/merges — List merges
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('merges')
      .select(`
        *,
        couples(id, person_a_name, person_b_name),
        prompt_templates(id, name, category)
      `)
      .order('created_at', { ascending: false });

    if (req.user.role === 'client') {
      // Get couples this client has access to
      const { data: accessRows } = await supabaseAdmin
        .from('client_access')
        .select('couple_id, paywall_unlocked')
        .eq('client_user_id', req.user.id);

      const unlockedCoupleIds = (accessRows || [])
        .filter((r) => r.paywall_unlocked)
        .map((r) => r.couple_id);

      if (unlockedCoupleIds.length === 0) {
        return res.json({ merges: [] });
      }

      query = query.in('couple_id', unlockedCoupleIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Merges list error:', error);
      return res.status(500).json({ error: 'Failed to fetch merges' });
    }

    res.json({ merges: data || [] });
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
      const { data: couple, error: coupleError } = await supabaseAdmin
        .from('couples')
        .select('id, person_a_name, person_b_name')
        .eq('id', couple_id)
        .single();

      if (coupleError || !couple) {
        return res.status(404).json({ error: 'Couple not found' });
      }

      // Verify template exists and is active
      const { data: template, error: templateError } = await supabaseAdmin
        .from('prompt_templates')
        .select('id, name, prompt_text')
        .eq('id', template_id)
        .eq('is_active', true)
        .single();

      if (templateError || !template) {
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
      const { data: merge, error: mergeCreateError } = await supabaseAdmin
        .from('merges')
        .insert({
          id: mergeId,
          couple_id,
          template_id,
          iris_a_url: irisAUrl,
          iris_b_url: irisBUrl,
          prompt_used: fullPrompt,
          status: 'pending',
          created_by: req.user.id,
        })
        .select()
        .single();

      if (mergeCreateError) {
        console.error('Merge record create error:', mergeCreateError);
        return res.status(500).json({ error: 'Failed to create merge record' });
      }

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
        await supabaseAdmin
          .from('merges')
          .update({ status: 'failed' })
          .eq('id', mergeId);
        return res.status(502).json({ error: `AI generation failed: ${genError.message}` });
      }

      // Upload result to generated-results bucket
      const resultFilename = `${mergeId}/result_${Date.now()}.png`;
      let resultUrl;
      try {
        resultUrl = await uploadImage(BUCKETS.GENERATED_RESULTS, resultFilename, resultImageBuffer, 'image/png');
      } catch (uploadErr) {
        console.error('Result upload error:', uploadErr);
        await supabaseAdmin.from('merges').update({ status: 'failed' }).eq('id', mergeId);
        return res.status(500).json({ error: 'Failed to store result image' });
      }

      // Update merge record with result
      const { data: updatedMerge, error: updateError } = await supabaseAdmin
        .from('merges')
        .update({ result_image_url: resultUrl, status: 'completed' })
        .eq('id', mergeId)
        .select(`
          *,
          couples(id, person_a_name, person_b_name),
          prompt_templates(id, name, category)
        `)
        .single();

      if (updateError) {
        console.error('Merge update error:', updateError);
        return res.status(500).json({ error: 'Failed to update merge record' });
      }

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

    const { data: merge, error } = await supabaseAdmin
      .from('merges')
      .select(`
        *,
        couples(id, person_a_name, person_b_name),
        prompt_templates(id, name, category, description)
      `)
      .eq('id', id)
      .single();

    if (error || !merge) {
      return res.status(404).json({ error: 'Merge not found' });
    }

    // Client access check
    if (req.user.role === 'client') {
      const { data: access } = await supabaseAdmin
        .from('client_access')
        .select('paywall_unlocked')
        .eq('client_user_id', req.user.id)
        .eq('couple_id', merge.couple_id)
        .single();

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

    const { error } = await supabaseAdmin
      .from('merges')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Merge delete error:', error);
      return res.status(500).json({ error: 'Failed to delete merge' });
    }

    res.json({ message: 'Merge deleted successfully' });
  } catch (err) {
    console.error('Merge delete handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
