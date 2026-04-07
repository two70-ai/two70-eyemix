const jwt = require('jsonwebtoken');
const { users } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

/**
 * Verify JWT token from httpOnly cookie and attach user to request
 */
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired, please log in again' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Fetch fresh user data from database
    const user = await users.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Require admin role
 */
async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

/**
 * Require client role
 */
async function requireClient(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user?.role !== 'client') {
      return res.status(403).json({ error: 'Client access required' });
    }
    next();
  });
}

/**
 * Generate JWT token
 */
function generateToken(userId, role) {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Set auth cookie
 */
function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * Clear auth cookie
 */
function clearAuthCookie(res) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  });
}

module.exports = { requireAuth, requireAdmin, requireClient, generateToken, setAuthCookie, clearAuthCookie };
