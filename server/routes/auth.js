const express = require('express');
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../services/supabase');
const { requireAuth, requireAdmin, generateToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { authValidation } = require('../utils/validation');

const router = express.Router();

// POST /api/auth/register — Admin registers new users
router.post('/register', requireAdmin, authValidation.register, async (req, res) => {
  try {
    const { email, password, role = 'client' } = req.body;

    // Check if user already exists
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({ email, password_hash, role })
      .select('id, email, role, created_at')
      .single();

    if (error) {
      console.error('Register error:', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    res.status(201).json({ user: newUser });
  } catch (err) {
    console.error('Register handler error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// POST /api/auth/login
router.post('/login', authValidation.login, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, password_hash, role, created_at')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token and set cookie
    const token = generateToken(user.id, user.role);
    setAuthCookie(res, token);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('Login handler error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me — Get current user
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/first-admin — Create first admin if no users exist (bootstrapping)
router.post('/first-admin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if any users exist
    const { count, error: countError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (count > 0) {
      return res.status(403).json({ error: 'Admin already exists. Use login instead.' });
    }

    // Create first admin
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const { data: newAdmin, error } = await supabaseAdmin
      .from('users')
      .insert({ email, password_hash, role: 'admin' })
      .select('id, email, role, created_at')
      .single();

    if (error) {
      console.error('First admin creation error:', error);
      return res.status(500).json({ error: 'Failed to create admin' });
    }

    const token = generateToken(newAdmin.id, newAdmin.role);
    setAuthCookie(res, token);

    res.status(201).json({ user: newAdmin });
  } catch (err) {
    console.error('First admin handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
