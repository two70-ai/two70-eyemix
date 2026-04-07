const express = require('express');
const { couples, clientAccess, users } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { coupleValidation } = require('../utils/validation');

const router = express.Router();

// GET /api/couples — List couples
router.get('/', requireAuth, async (req, res) => {
  try {
    // Clients only see their own couples via client_access table
    if (req.user.role === 'client') {
      const coupleIds = await clientAccess.findCoupleIdsByClient(req.user.id);

      if (coupleIds.length === 0) {
        return res.json({ couples: [] });
      }

      const data = await couples.findAllByIds(coupleIds);
      return res.json({ couples: data });
    }

    // Admin path: return all couples
    const data = await couples.findAll();
    res.json({ couples: data });
  } catch (err) {
    console.error('Couples list handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/couples — Create couple (admin only)
router.post('/', requireAdmin, coupleValidation.create, async (req, res) => {
  try {
    const { person_a_name, person_b_name, client_user_id } = req.body;

    let couple;
    try {
      couple = await couples.create({ person_a_name, person_b_name, created_by: req.user.id });
    } catch (err) {
      console.error('Couple create error:', err);
      return res.status(500).json({ error: 'Failed to create couple' });
    }

    // Optionally link to a client user
    if (client_user_id) {
      try {
        await clientAccess.create({ client_user_id, couple_id: couple.id, paywall_unlocked: false });
      } catch (err) {
        console.warn('Failed to create client_access record:', err);
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
      const access = await clientAccess.findByClientAndCouple(req.user.id, id);

      if (!access) {
        return res.status(403).json({ error: 'Access denied to this couple' });
      }
    }

    const couple = await couples.findById(id);

    if (!couple) {
      return res.status(404).json({ error: 'Couple not found' });
    }

    // Attach access info for clients
    if (req.user.role === 'client') {
      const access = await clientAccess.findByClientAndCouple(req.user.id, id);
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
    const couple = await couples.findByIdSimple(id);

    if (!couple) {
      return res.status(404).json({ error: 'Couple not found' });
    }

    // Delete cascades to merges and client_access via DB foreign keys
    try {
      await couples.delete(id);
    } catch (err) {
      console.error('Couple delete error:', err);
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
    const couple = await couples.findByIdSimple(id);
    if (!couple) return res.status(404).json({ error: 'Couple not found' });

    // Verify client user exists and is a client
    const clientUser = await users.findByIdAndRole(client_user_id, 'client');
    if (!clientUser) return res.status(404).json({ error: 'Client user not found' });

    let access;
    try {
      access = await clientAccess.upsert({ client_user_id, couple_id: id, paywall_unlocked: false });
    } catch (err) {
      console.error('Grant access upsert error:', err);
      return res.status(500).json({ error: 'Failed to grant access' });
    }

    res.json({ access });
  } catch (err) {
    console.error('Grant access handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
