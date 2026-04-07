'use strict';

// Mock the db module so tests never touch a real database
jest.mock('../../db', () => ({
  users: {
    findById: jest.fn(),
  },
}));

const jwt = require('jsonwebtoken');
const { users } = require('../../db');

// Load the middleware AFTER the mock is in place
const {
  requireAuth,
  requireAdmin,
  requireClient,
  generateToken,
  setAuthCookie,
  clearAuthCookie,
} = require('../auth');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

function makeToken(payload, options = {}) {
  return jwt.sign(payload, SECRET, { expiresIn: '1h', ...options });
}

function makeReq(overrides = {}) {
  return {
    cookies: {},
    ...overrides,
  };
}

function makeRes() {
  const res = {
    _status: null,
    _body: null,
    _cookies: {},
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
    cookie(name, value, opts) {
      this._cookies[name] = { value, opts };
      return this;
    },
    clearCookie(name, opts) {
      this._cookies[name] = { value: null, opts };
      return this;
    },
  };
  return res;
}

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------

describe('requireAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when no token cookie is present', async () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with TokenExpiredError message when token is expired', async () => {
    const token = makeToken({ userId: 'u1', role: 'admin' }, { expiresIn: '-1s' });
    const req = makeReq({ cookies: { token } });
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'Token expired, please log in again' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with Invalid token message for a tampered token', async () => {
    const req = makeReq({ cookies: { token: 'totally.invalid.token' } });
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when users.findById returns null (user deleted after token issued)', async () => {
    users.findById.mockResolvedValue(null);
    const token = makeToken({ userId: 'ghost-user', role: 'client' });
    const req = makeReq({ cookies: { token } });
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(users.findById).toHaveBeenCalledWith('ghost-user');
    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches user to req and calls next on success', async () => {
    const dbUser = { id: 'u1', email: 'a@b.com', role: 'admin', created_at: '2024-01-01' };
    users.findById.mockResolvedValue(dbUser);
    const token = makeToken({ userId: 'u1', role: 'admin' });
    const req = makeReq({ cookies: { token } });
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(users.findById).toHaveBeenCalledWith('u1');
    expect(req.user).toEqual(dbUser);
    expect(next).toHaveBeenCalled();
    expect(res._status).toBeNull();
  });

  it('returns 500 when users.findById throws unexpectedly', async () => {
    users.findById.mockRejectedValue(new Error('DB down'));
    const token = makeToken({ userId: 'u1', role: 'admin' });
    const req = makeReq({ cookies: { token } });
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res._status).toBe(500);
    expect(res._body).toEqual({ error: 'Authentication error' });
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// requireAdmin
// ---------------------------------------------------------------------------

describe('requireAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls next when user is admin', async () => {
    users.findById.mockResolvedValue({ id: 'a1', email: 'admin@x.com', role: 'admin', created_at: '' });
    const token = makeToken({ userId: 'a1', role: 'admin' });
    const req = makeReq({ cookies: { token } });
    const res = makeRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when user is a client, not admin', async () => {
    users.findById.mockResolvedValue({ id: 'c1', email: 'client@x.com', role: 'client', created_at: '' });
    const token = makeToken({ userId: 'c1', role: 'client' });
    const req = makeReq({ cookies: { token } });
    const res = makeRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(res._status).toBe(403);
    expect(res._body).toEqual({ error: 'Admin access required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('propagates 401 from requireAuth when token is absent', async () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// requireClient
// ---------------------------------------------------------------------------

describe('requireClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls next when user is a client', async () => {
    users.findById.mockResolvedValue({ id: 'c1', email: 'client@x.com', role: 'client', created_at: '' });
    const token = makeToken({ userId: 'c1', role: 'client' });
    const req = makeReq({ cookies: { token } });
    const res = makeRes();
    const next = jest.fn();

    await requireClient(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when user is admin, not client', async () => {
    users.findById.mockResolvedValue({ id: 'a1', email: 'admin@x.com', role: 'admin', created_at: '' });
    const token = makeToken({ userId: 'a1', role: 'admin' });
    const req = makeReq({ cookies: { token } });
    const res = makeRes();
    const next = jest.fn();

    await requireClient(req, res, next);

    expect(res._status).toBe(403);
    expect(res._body).toEqual({ error: 'Client access required' });
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// generateToken
// ---------------------------------------------------------------------------

describe('generateToken', () => {
  it('produces a JWT that decodes with the expected payload', () => {
    const token = generateToken('user-123', 'admin');
    const decoded = jwt.verify(token, SECRET);
    expect(decoded.userId).toBe('user-123');
    expect(decoded.role).toBe('admin');
  });

  it('sets a 7-day expiry', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = generateToken('u', 'client');
    const decoded = jwt.decode(token);
    const sevenDaysSeconds = 7 * 24 * 60 * 60;
    expect(decoded.exp - decoded.iat).toBe(sevenDaysSeconds);
    expect(decoded.iat).toBeGreaterThanOrEqual(before);
  });
});

// ---------------------------------------------------------------------------
// setAuthCookie / clearAuthCookie
// ---------------------------------------------------------------------------

describe('setAuthCookie', () => {
  it('sets an httpOnly cookie named "token"', () => {
    const res = makeRes();
    setAuthCookie(res, 'my-token');
    expect(res._cookies.token.value).toBe('my-token');
    expect(res._cookies.token.opts.httpOnly).toBe(true);
  });

  it('uses lax sameSite outside production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const res = makeRes();
    setAuthCookie(res, 'tok');
    expect(res._cookies.token.opts.sameSite).toBe('lax');
    process.env.NODE_ENV = originalEnv;
  });

  it('uses strict sameSite and secure in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const res = makeRes();
    setAuthCookie(res, 'tok');
    expect(res._cookies.token.opts.sameSite).toBe('strict');
    expect(res._cookies.token.opts.secure).toBe(true);
    process.env.NODE_ENV = originalEnv;
  });
});

describe('clearAuthCookie', () => {
  it('clears the "token" cookie', () => {
    const res = makeRes();
    clearAuthCookie(res);
    expect(res._cookies.token.value).toBeNull();
    expect(res._cookies.token.opts.httpOnly).toBe(true);
  });
});
