const express = require('express');
const { promptTemplates } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { templateValidation } = require('../utils/validation');
const nanoBanana = require('../services/nanoBanana');
const { uploadImage, BUCKETS } = require('../services/storageFactory');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// GET /api/templates — List all active templates
router.get('/', requireAuth, async (req, res) => {
  try {
    const activeOnly = req.user.role !== 'admin';
    const data = await promptTemplates.findAll({ activeOnly });
    res.json({ templates: data });
  } catch (err) {
    console.error('Templates list handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/templates — Create template (admin only)
router.post('/', requireAdmin, templateValidation.create, async (req, res) => {
  try {
    const { name, description, prompt_text, category, is_active = true } = req.body;

    const template = await promptTemplates.create({ name, description, prompt_text, category, is_active });

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

    const template = await promptTemplates.update(id, updates);

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

    await promptTemplates.delete(id);

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
    const template = await promptTemplates.findById(id);

    if (!template) {
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
    const updatedTemplate = await promptTemplates.update(id, { reference_image_url: publicUrl });

    if (!updatedTemplate) {
      console.error('Template reference URL update error: template not found after update');
      return res.status(500).json({ error: 'Failed to update template reference URL' });
    }

    res.json({ template: updatedTemplate, reference_image_url: publicUrl });
  } catch (err) {
    console.error('Reference generation handler error:', err);
    res.status(500).json({ error: 'Server error during reference generation' });
  }
});

module.exports = router;
