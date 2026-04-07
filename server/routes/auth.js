const express = require('express');
const bcrypt = require('bcryptjs');
const { users } = require('../db');
const { requireAuth, requireAdmin, generateToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { authValidation } = require('../utils/validation');

const router = express.Router();

// POST /api/auth/register — Admin registers new users
router.post('/register', requireAdmin, authValidation.register, async (req, res) => {
  try {
    const { email, password, role = 'client' } = req.body;

    // Check if user already exists
    const existing = await users.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    let newUser;
    try {
      newUser = await users.create({ email, password_hash, role });
    } catch (err) {
      console.error('Register error:', err);
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
    const user = await users.findByEmail(email);
    if (!user) {
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
    const count = await users.count();

    if (count > 0) {
      return res.status(403).json({ error: 'Admin already exists. Use login instead.' });
    }

    // Create first admin
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    let newAdmin;
    try {
      newAdmin = await users.create({ email, password_hash, role: 'admin' });
    } catch (err) {
      console.error('First admin creation error:', err);
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
