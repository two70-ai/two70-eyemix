const express = require('express');
const { clientAccess, couples, merges } = require('../db');
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
    const couple = await couples.findByIdSimple(couple_id);

    if (!couple) {
      return res.status(404).json({ error: 'Couple not found' });
    }

    // Upsert client_access record to mark as unlocked
    let access;
    try {
      access = await clientAccess.upsert({
        client_user_id: userId,
        couple_id,
        paywall_unlocked: true,
        unlocked_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Client unlock error:', err);
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
    const accessRecords = await clientAccess.findAllByClient(req.user.id);
    res.json({ access: accessRecords });
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
    const access = await clientAccess.findByClientAndCouple(userId, coupleId);

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
    let mergesList;
    try {
      mergesList = await merges.findAllByCoupleIdAndStatus(coupleId, 'completed');
    } catch (err) {
      console.error('Client merges fetch error:', err);
      return res.status(500).json({ error: 'Failed to fetch results' });
    }

    res.json({ merges: mergesList });
  } catch (err) {
    console.error('Client merges handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
