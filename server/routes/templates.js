const express = require('express');
const { supabaseAdmin } = require('../services/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { templateValidation } = require('../utils/validation');
const nanoBanana = require('../services/nanoBanana');
const { uploadImage, BUCKETS } = require('../services/storage');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// GET /api/templates — List all active templates
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('prompt_templates')
      .select('*')
      .order('created_at', { ascending: false });

    // Non-admins only see active templates
    if (req.user.role !== 'admin') {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Templates list error:', error);
      return res.status(500).json({ error: 'Failed to fetch templates' });
    }

    res.json({ templates: data || [] });
  } catch (err) {
    console.error('Templates list handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/templates — Create template (admin only)
router.post('/', requireAdmin, templateValidation.create, async (req, res) => {
  try {
    const { name, description, prompt_text, category, is_active = true } = req.body;

    const { data: template, error } = await supabaseAdmin
      .from('prompt_templates')
      .insert({ name, description, prompt_text, category, is_active })
      .select()
      .single();

    if (error) {
      console.error('Template create error:', error);
      return res.status(500).json({ error: 'Failed to create template' });
    }

    res.status(201).json({ template });
  } catch (err) {
    console.error('Template create handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/templates/:id — Update template (admin only)
router.put('/:id', requireAdmin, templateValidation.update, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, prompt_text, category, is_active } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (prompt_text !== undefined) updates.prompt_text = prompt_text;
    if (category !== undefined) updates.category = category;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: template, error } = await supabaseAdmin
      .from('prompt_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Template update error:', error);
      return res.status(500).json({ error: 'Failed to update template' });
    }

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (err) {
    console.error('Template update handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/templates/:id — Delete template (admin only)
router.delete('/:id', requireAdmin, templateValidation.idParam, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('prompt_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Template delete error:', error);
      return res.status(500).json({ error: 'Failed to delete template' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    console.error('Template delete handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/templates/:id/reference — Generate reference image for template (admin only)
router.post('/:id/reference', requireAdmin, templateValidation.idParam, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch template
    const { data: template, error: fetchError } = await supabaseAdmin
      .from('prompt_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Generate reference image using NanoBanana with placeholder irises
    let imageBuffer;
    try {
      imageBuffer = await nanoBanana.generateReferenceImage(template.prompt_text);
    } catch (genError) {
      console.error('NanoBanana reference generation error:', genError);
      return res.status(502).json({ error: `AI generation failed: ${genError.message}` });
    }

    // Upload to reference-images bucket
    const filename = `reference-${id}-${uuidv4()}.png`;
    let publicUrl;
    try {
      publicUrl = await uploadImage(BUCKETS.REFERENCE_IMAGES, filename, imageBuffer, 'image/png');
    } catch (uploadError) {
      console.error('Storage upload error:', uploadError);
      return res.status(500).json({ error: `Failed to store reference image: ${uploadError.message}` });
    }

    // Update template with reference image URL
    const { data: updatedTemplate, error: updateError } = await supabaseAdmin
      .from('prompt_templates')
      .update({ reference_image_url: publicUrl })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Template reference URL update error:', updateError);
      return res.status(500).json({ error: 'Failed to update template reference URL' });
    }

    res.json({ template: updatedTemplate, reference_image_url: publicUrl });
  } catch (err) {
    console.error('Reference generation handler error:', err);
    res.status(500).json({ error: 'Server error during reference generation' });
  }
});

module.exports = router;
