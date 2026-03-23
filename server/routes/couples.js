const express = require('express');
const { supabaseAdmin } = require('../services/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { coupleValidation } = require('../utils/validation');

const router = express.Router();

// GET /api/couples — List couples
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('couples')
      .select('*, users!couples_created_by_fkey(email)')
      .order('created_at', { ascending: false });

    // Clients only see their own couples via client_access table
    if (req.user.role === 'client') {
      const { data: accessRows } = await supabaseAdmin
        .from('client_access')
        .select('couple_id')
        .eq('client_user_id', req.user.id);

      const coupleIds = (accessRows || []).map((r) => r.couple_id);

      if (coupleIds.length === 0) {
        return res.json({ couples: [] });
      }

      query = query.in('id', coupleIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Couples list error:', error);
      return res.status(500).json({ error: 'Failed to fetch couples' });
    }

    res.json({ couples: data || [] });
  } catch (err) {
    console.error('Couples list handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/couples — Create couple (admin only)
router.post('/', requireAdmin, coupleValidation.create, async (req, res) => {
  try {
    const { person_a_name, person_b_name, client_user_id } = req.body;

    const { data: couple, error } = await supabaseAdmin
      .from('couples')
      .insert({
        person_a_name,
        person_b_name,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Couple create error:', error);
      return res.status(500).json({ error: 'Failed to create couple' });
    }

    // Optionally link to a client user
    if (client_user_id) {
      const { error: accessError } = await supabaseAdmin
        .from('client_access')
        .insert({
          client_user_id,
          couple_id: couple.id,
          paywall_unlocked: false,
        });

      if (accessError) {
        console.warn('Failed to create client_access record:', accessError);
      }
    }

    res.status(201).json({ couple });
  } catch (err) {
    console.error('Couple create handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/couples/:id — Get couple detail
router.get('/:id', requireAuth, coupleValidation.idParam, async (req, res) => {
  try {
    const { id } = req.params;

    // Client: verify they have access
    if (req.user.role === 'client') {
      const { data: access } = await supabaseAdmin
        .from('client_access')
        .select('couple_id, paywall_unlocked')
        .eq('client_user_id', req.user.id)
        .eq('couple_id', id)
        .single();

      if (!access) {
        return res.status(403).json({ error: 'Access denied to this couple' });
      }
    }

    const { data: couple, error } = await supabaseAdmin
      .from('couples')
      .select('*, users!couples_created_by_fkey(email)')
      .eq('id', id)
      .single();

    if (error || !couple) {
      return res.status(404).json({ error: 'Couple not found' });
    }

    // Attach access info for clients
    if (req.user.role === 'client') {
      const { data: access } = await supabaseAdmin
        .from('client_access')
        .select('paywall_unlocked, unlocked_at')
        .eq('client_user_id', req.user.id)
        .eq('couple_id', id)
        .single();
      couple.client_access = access;
    }

    res.json({ couple });
  } catch (err) {
    console.error('Couple detail handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/couples/:id — Delete couple (admin only)
router.delete('/:id', requireAdmin, coupleValidation.idParam, async (req, res) => {
  try {
    const { id } = req.params;

    // Check couple exists
    const { data: couple } = await supabaseAdmin
      .from('couples')
      .select('id')
      .eq('id', id)
      .single();

    if (!couple) {
      return res.status(404).json({ error: 'Couple not found' });
    }

    // Delete cascades to merges and client_access via DB foreign keys
    const { error } = await supabaseAdmin
      .from('couples')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Couple delete error:', error);
      return res.status(500).json({ error: 'Failed to delete couple' });
    }

    res.json({ message: 'Couple deleted successfully' });
  } catch (err) {
    console.error('Couple delete handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/couples/:id/access — Grant client access to a couple (admin only)
router.post('/:id/access', requireAdmin, coupleValidation.idParam, async (req, res) => {
  try {
    const { id } = req.params;
    const { client_user_id } = req.body;

    if (!client_user_id) {
      return res.status(400).json({ error: 'client_user_id required' });
    }

    // Verify couple exists
    const { data: couple } = await supabaseAdmin.from('couples').select('id').eq('id', id).single();
    if (!couple) return res.status(404).json({ error: 'Couple not found' });

    // Verify client user exists and is a client
    const { data: clientUser } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', client_user_id)
      .eq('role', 'client')
      .single();
    if (!clientUser) return res.status(404).json({ error: 'Client user not found' });

    const { data: access, error } = await supabaseAdmin
      .from('client_access')
      .upsert({ client_user_id, couple_id: id, paywall_unlocked: false }, { onConflict: 'client_user_id,couple_id' })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to grant access' });
    }

    res.json({ access });
  } catch (err) {
    console.error('Grant access handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
