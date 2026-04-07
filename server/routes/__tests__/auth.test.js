'use strict';

// ---------------------------------------------------------------------------
// Mock heavy/external dependencies before requiring the router
// ---------------------------------------------------------------------------

jest.mock('../../db', () => ({
  users: {
    findByEmail: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
}));

// Stub auth middleware so route tests focus on route logic, not JWT/cookie work
jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    // Simulate an authenticated user; individual tests can override req.user
    req.user = req._stubUser || { id: 'admin-1', email: 'admin@x.com', role: 'admin', created_at: '' };
    next();
  },
  requireAdmin: (req, res, next) => {
    req.user = req._stubUser || { id: 'admin-1', email: 'admin@x.com', role: 'admin', created_at: '' };
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  },
  generateToken: jest.fn(() => 'stub-token'),
  setAuthCookie: jest.fn(),
  clearAuthCookie: jest.fn(),
}));

// Stub bcrypt so password tests are fast and deterministic
jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-pw')),
  compare: jest.fn(),
}));

// Stub the validation util so all authValidation arrays are no-ops in route tests.
// This is simpler and more robust than trying to mock express-validator's chain API.
const passThrough = (req, res, next) => next();
jest.mock('../../utils/validation', () => ({
  authValidation: {
    register: [passThrough],
    login: [passThrough],
  },
  handleValidationErrors: passThrough,
}));

const express = require('express');
const cookieParser = require('cookie-parser');
// Use a simple JSON body parser for tests
const { users } = require('../../db');
const bcrypt = require('bcryptjs');
const { generateToken, setAuthCookie, clearAuthCookie } = require('../../middleware/auth');

// Import the router under test
const authRouter = require('../auth');

// ---------------------------------------------------------------------------
// Test app setup
// ---------------------------------------------------------------------------

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  // Mount at root so paths in tests match the router's relative paths
  app.use('/', authRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Minimal in-process HTTP helper (avoids supertest dependency)
// ---------------------------------------------------------------------------

const http = require('http');

function request(app, { method, path, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const bodyStr = body ? JSON.stringify(body) : '';
      const opts = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          ...headers,
        },
      };
      const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          server.close();
          let json;
          try { json = JSON.parse(data); } catch { json = data; }
          resolve({ status: res.statusCode, body: json });
        });
      });
      req.on('error', (err) => { server.close(); reject(err); });
      req.write(bodyStr);
      req.end();
    });
  });
}

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------

describe('POST /register', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns 409 when email already exists', async () => {
    users.findByEmail.mockResolvedValue({ id: 'existing', email: 'a@b.com' });

    const res = await request(app, {
      method: 'POST',
      path: '/register',
      body: { email: 'a@b.com', password: 'secret123' },
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
    expect(users.create).not.toHaveBeenCalled();
  });

  it('creates a user and returns 201 on success', async () => {
    users.findByEmail.mockResolvedValue(null);
    const created = { id: 'new-1', email: 'new@b.com', role: 'client', created_at: '2024-01-01' };
    users.create.mockResolvedValue(created);

    const res = await request(app, {
      method: 'POST',
      path: '/register',
      body: { email: 'new@b.com', password: 'secret123' },
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual(created);
    expect(users.create).toHaveBeenCalledWith({
      email: 'new@b.com',
      password_hash: 'hashed-pw',
      role: 'client',
    });
  });

  it('respects an explicit role in the request body', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue({ id: 'a1', email: 'adm@b.com', role: 'admin', created_at: '' });

    await request(app, {
      method: 'POST',
      path: '/register',
      body: { email: 'adm@b.com', password: 'secret123', role: 'admin' },
    });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin' })
    );
  });

  it('returns 500 when users.create throws', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockRejectedValue(new Error('DB error'));

    const res = await request(app, {
      method: 'POST',
      path: '/register',
      body: { email: 'x@b.com', password: 'secret123' },
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to create user/i);
  });
});

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------

describe('POST /login', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns 401 when user is not found by email', async () => {
    users.findByEmail.mockResolvedValue(null);

    const res = await request(app, {
      method: 'POST',
      path: '/login',
      body: { email: 'nope@b.com', password: 'pw' },
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid email or password/i);
  });

  it('returns 401 when password is wrong', async () => {
    users.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com', password_hash: 'hash', role: 'client', created_at: '' });
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app, {
      method: 'POST',
      path: '/login',
      body: { email: 'a@b.com', password: 'wrong' },
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid email or password/i);
  });

  it('returns user data (without password_hash) on successful login', async () => {
    const dbUser = { id: 'u1', email: 'a@b.com', password_hash: 'hash', role: 'client', created_at: '2024-01-01' };
    users.findByEmail.mockResolvedValue(dbUser);
    bcrypt.compare.mockResolvedValue(true);

    const res = await request(app, {
      method: 'POST',
      path: '/login',
      body: { email: 'a@b.com', password: 'correctpw' },
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: 'u1',
      email: 'a@b.com',
      role: 'client',
      created_at: '2024-01-01',
    });
    // password_hash must NOT be in the response
    expect(res.body.user.password_hash).toBeUndefined();
    expect(generateToken).toHaveBeenCalledWith('u1', 'client');
    expect(setAuthCookie).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /logout
// ---------------------------------------------------------------------------

describe('POST /logout', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('clears the auth cookie and returns a success message', async () => {
    const res = await request(app, {
      method: 'POST',
      path: '/logout',
      body: {},
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logged out/i);
    expect(clearAuthCookie).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /me
// ---------------------------------------------------------------------------

describe('GET /me', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns the user attached by requireAuth', async () => {
    const res = await request(app, {
      method: 'GET',
      path: '/me',
      body: {},
    });

    expect(res.status).toBe(200);
    // The stub requireAuth sets a default admin user
    expect(res.body.user).toMatchObject({ role: 'admin' });
  });
});

// ---------------------------------------------------------------------------
// POST /first-admin
// ---------------------------------------------------------------------------

describe('POST /first-admin', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns 400 when email or password is missing', async () => {
    const res = await request(app, {
      method: 'POST',
      path: '/first-admin',
      body: { email: 'a@b.com' }, // no password
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 403 when users already exist (count > 0)', async () => {
    users.count.mockResolvedValue(1);

    const res = await request(app, {
      method: 'POST',
      path: '/first-admin',
      body: { email: 'admin@b.com', password: 'secret123' },
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/already exists/i);
    expect(users.create).not.toHaveBeenCalled();
  });

  it('creates admin and returns 201 when no users exist', async () => {
    users.count.mockResolvedValue(0);
    const newAdmin = { id: 'a1', email: 'admin@b.com', role: 'admin', created_at: '2024-01-01' };
    users.create.mockResolvedValue(newAdmin);

    const res = await request(app, {
      method: 'POST',
      path: '/first-admin',
      body: { email: 'admin@b.com', password: 'secret123' },
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual(newAdmin);
    expect(users.create).toHaveBeenCalledWith({
      email: 'admin@b.com',
      password_hash: 'hashed-pw',
      role: 'admin',
    });
    expect(generateToken).toHaveBeenCalledWith('a1', 'admin');
    expect(setAuthCookie).toHaveBeenCalled();
  });

  it('returns 500 when users.create throws during first-admin creation', async () => {
    users.count.mockResolvedValue(0);
    users.create.mockRejectedValue(new Error('write failed'));

    const res = await request(app, {
      method: 'POST',
      path: '/first-admin',
      body: { email: 'admin@b.com', password: 'secret123' },
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to create admin/i);
  });

  it('returns 500 when users.count throws', async () => {
    users.count.mockRejectedValue(new Error('count failed'));

    const res = await request(app, {
      method: 'POST',
      path: '/first-admin',
      body: { email: 'admin@b.com', password: 'secret123' },
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Server error/i);
  });
});
