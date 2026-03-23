const express = require('express');
const { supabaseAdmin } = require('../services/supabase');
const { requireAuth } = require('../middleware/auth');
const { clientValidation } = require('../utils/validation');

const router = express.Router();

// POST /api/client/unlock — Verify paywall password and unlock couple access
router.post('/unlock', requireAuth, clientValidation.unlock, async (req, res) => {
  try {
    const { password, couple_id } = req.body;
    const userId = req.user.id;

    const correctPassword = process.env.CLIENT_PAYWALL_PASSWORD || 'iloveaiimages';

    if (password !== correctPassword) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Check couple exists
    const { data: couple } = await supabaseAdmin
      .from('couples')
      .select('id')
      .eq('id', couple_id)
      .single();

    if (!couple) {
      return res.status(404).json({ error: 'Couple not found' });
    }

    // Upsert client_access record to mark as unlocked
    const { data: access, error } = await supabaseAdmin
      .from('client_access')
      .upsert(
        {
          client_user_id: userId,
          couple_id,
          paywall_unlocked: true,
          unlocked_at: new Date().toISOString(),
        },
        { onConflict: 'client_user_id,couple_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Client unlock error:', error);
      return res.status(500).json({ error: 'Failed to unlock access' });
    }

    res.json({ message: 'Access unlocked successfully', access });
  } catch (err) {
    console.error('Client unlock handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/client/access — Get all access records for current client
router.get('/access', requireAuth, async (req, res) => {
  try {
    const { data: accessRecords, error } = await supabaseAdmin
      .from('client_access')
      .select(`
        *,
        couples(id, person_a_name, person_b_name, created_at)
      `)
      .eq('client_user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Client access list error:', error);
      return res.status(500).json({ error: 'Failed to fetch access records' });
    }

    res.json({ access: accessRecords || [] });
  } catch (err) {
    console.error('Client access list handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/client/merges/:coupleId — Get merges for a specific couple (paywall required)
router.get('/merges/:coupleId', requireAuth, async (req, res) => {
  try {
    const { coupleId } = req.params;
    const userId = req.user.id;

    // Verify paywall is unlocked for this couple
    const { data: access } = await supabaseAdmin
      .from('client_access')
      .select('paywall_unlocked')
      .eq('client_user_id', userId)
      .eq('couple_id', coupleId)
      .single();

    if (!access) {
      return res.status(403).json({ error: 'No access to this couple' });
    }

    if (!access.paywall_unlocked) {
      return res.status(402).json({
        error: 'Paywall locked',
        message: 'Please enter the access password to view results',
        requiresUnlock: true,
      });
    }

    // Fetch merges for this couple
    const { data: merges, error } = await supabaseAdmin
      .from('merges')
      .select(`
        *,
        prompt_templates(id, name, category, description)
      `)
      .eq('couple_id', coupleId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Client merges fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch results' });
    }

    res.json({ merges: merges || [] });
  } catch (err) {
    console.error('Client merges handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
