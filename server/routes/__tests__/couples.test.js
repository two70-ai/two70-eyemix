'use strict';

// ---------------------------------------------------------------------------
// Mock the db abstraction layer before any require of the route
// ---------------------------------------------------------------------------
const mockDb = {
  couples: {
    findAll: jest.fn(),
    findAllByIds: jest.fn(),
    findById: jest.fn(),
    findByIdSimple: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  clientAccess: {
    findCoupleIdsByClient: jest.fn(),
    findByClientAndCouple: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  users: {
    findByIdAndRole: jest.fn(),
  },
};

jest.mock('../../db', () => mockDb);

// Mock auth middleware: requireAuth and requireAdmin attach a default user
// and call next(). Tests override req.user by configuring the mock below.
let mockUser = { id: 'admin-1', role: 'admin' };

jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, _res, next) => { req.user = mockUser; next(); },
  requireAdmin: (req, res, next) => {
    req.user = mockUser;
    if (mockUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const couplesRouter = require('../couples');

// ---------------------------------------------------------------------------
// Test HTTP server helpers
// ---------------------------------------------------------------------------
let server;
let baseUrl;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/couples', couplesRouter);
  return app;
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const bodyStr = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', reject);

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

beforeAll((done) => {
  server = http.createServer(makeApp());
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  jest.clearAllMocks();
  // Reset to admin user by default
  mockUser = { id: 'admin-1', role: 'admin' };
});

// ---------------------------------------------------------------------------
// GET /api/couples — admin path
// ---------------------------------------------------------------------------
describe('GET /api/couples', () => {
  describe('as admin', () => {
    it('returns all couples from couples.findAll()', async () => {
      const rows = [{ id: 'c1', person_a_name: 'A', person_b_name: 'B' }];
      mockDb.couples.findAll.mockResolvedValue(rows);

      const { status, body } = await request('GET', '/api/couples');

      expect(status).toBe(200);
      expect(body).toEqual({ couples: rows });
      expect(mockDb.couples.findAll).toHaveBeenCalledTimes(1);
      expect(mockDb.clientAccess.findCoupleIdsByClient).not.toHaveBeenCalled();
    });

    it('returns empty array when no couples exist', async () => {
      mockDb.couples.findAll.mockResolvedValue([]);

      const { status, body } = await request('GET', '/api/couples');

      expect(status).toBe(200);
      expect(body).toEqual({ couples: [] });
    });

    it('returns 500 when couples.findAll() throws', async () => {
      mockDb.couples.findAll.mockRejectedValue(new Error('db down'));

      const { status, body } = await request('GET', '/api/couples');

      expect(status).toBe(500);
      expect(body.error).toBe('Server error');
    });
  });

  describe('as client', () => {
    beforeEach(() => {
      mockUser = { id: 'client-1', role: 'client' };
    });

    it('returns couples filtered by client_access', async () => {
      const ids = ['c1', 'c2'];
      const rows = [{ id: 'c1' }, { id: 'c2' }];
      mockDb.clientAccess.findCoupleIdsByClient.mockResolvedValue(ids);
      mockDb.couples.findAllByIds.mockResolvedValue(rows);

      const { status, body } = await request('GET', '/api/couples');

      expect(status).toBe(200);
      expect(body).toEqual({ couples: rows });
      expect(mockDb.clientAccess.findCoupleIdsByClient).toHaveBeenCalledWith('client-1');
      expect(mockDb.couples.findAllByIds).toHaveBeenCalledWith(ids);
      expect(mockDb.couples.findAll).not.toHaveBeenCalled();
    });

    it('returns empty array immediately when client has no access records', async () => {
      mockDb.clientAccess.findCoupleIdsByClient.mockResolvedValue([]);

      const { status, body } = await request('GET', '/api/couples');

      expect(status).toBe(200);
      expect(body).toEqual({ couples: [] });
      expect(mockDb.couples.findAllByIds).not.toHaveBeenCalled();
    });

    it('returns 500 when findCoupleIdsByClient throws', async () => {
      mockDb.clientAccess.findCoupleIdsByClient.mockRejectedValue(new Error('db error'));

      const { status, body } = await request('GET', '/api/couples');

      expect(status).toBe(500);
      expect(body.error).toBe('Server error');
    });

    it('returns 500 when findAllByIds throws', async () => {
      mockDb.clientAccess.findCoupleIdsByClient.mockResolvedValue(['c1']);
      mockDb.couples.findAllByIds.mockRejectedValue(new Error('db error'));

      const { status, body } = await request('GET', '/api/couples');

      expect(status).toBe(500);
      expect(body.error).toBe('Server error');
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/couples — admin only
// ---------------------------------------------------------------------------
describe('POST /api/couples', () => {
  const validBody = { person_a_name: 'Alice', person_b_name: 'Bob' };
  const createdCouple = { id: 'c-new', person_a_name: 'Alice', person_b_name: 'Bob' };

  it('creates couple and returns 201', async () => {
    mockDb.couples.create.mockResolvedValue(createdCouple);

    const { status, body } = await request('POST', '/api/couples', validBody);

    expect(status).toBe(201);
    expect(body).toEqual({ couple: createdCouple });
    expect(mockDb.couples.create).toHaveBeenCalledWith({
      person_a_name: 'Alice',
      person_b_name: 'Bob',
      created_by: 'admin-1',
    });
  });

  it('optionally creates client_access when client_user_id is provided', async () => {
    mockDb.couples.create.mockResolvedValue(createdCouple);
    mockDb.clientAccess.create.mockResolvedValue();

    const { status, body } = await request('POST', '/api/couples', {
      ...validBody,
      client_user_id: 'client-1',
    });

    expect(status).toBe(201);
    expect(body.couple).toEqual(createdCouple);
    expect(mockDb.clientAccess.create).toHaveBeenCalledWith({
      client_user_id: 'client-1',
      couple_id: createdCouple.id,
      paywall_unlocked: false,
    });
  });

  it('still returns 201 when client_access.create fails (warns only)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockDb.couples.create.mockResolvedValue(createdCouple);
    mockDb.clientAccess.create.mockRejectedValue(new Error('insert fail'));

    const { status, body } = await request('POST', '/api/couples', {
      ...validBody,
      client_user_id: 'client-1',
    });

    expect(status).toBe(201);
    expect(body.couple).toEqual(createdCouple);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns 500 when couples.create throws', async () => {
    mockDb.couples.create.mockRejectedValue(new Error('insert error'));

    const { status, body } = await request('POST', '/api/couples', validBody);

    expect(status).toBe(500);
    expect(body.error).toBe('Failed to create couple');
  });

  it('returns 400 when person_a_name is missing (validation)', async () => {
    const { status, body } = await request('POST', '/api/couples', { person_b_name: 'Bob' });

    expect(status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(mockDb.couples.create).not.toHaveBeenCalled();
  });

  it('returns 403 when called by a non-admin user', async () => {
    mockUser = { id: 'client-1', role: 'client' };

    const { status } = await request('POST', '/api/couples', validBody);

    expect(status).toBe(403);
    expect(mockDb.couples.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/couples/:id
// ---------------------------------------------------------------------------
describe('GET /api/couples/:id', () => {
  const coupleId = 'b8b99e7d-265f-400c-8ca4-ff661bc49ce2';
  const couple = { id: coupleId, person_a_name: 'A', person_b_name: 'B' };

  it('returns couple for admin', async () => {
    mockDb.couples.findById.mockResolvedValue(couple);

    const { status, body } = await request('GET', `/api/couples/${coupleId}`);

    expect(status).toBe(200);
    expect(body).toEqual({ couple });
    expect(mockDb.clientAccess.findByClientAndCouple).not.toHaveBeenCalled();
  });

  it('returns 404 when couple not found (admin)', async () => {
    mockDb.couples.findById.mockResolvedValue(null);

    const { status, body } = await request('GET', `/api/couples/${coupleId}`);

    expect(status).toBe(404);
    expect(body.error).toBe('Couple not found');
  });

  it('returns couple with client_access attached for client', async () => {
    mockUser = { id: 'client-1', role: 'client' };
    const accessRecord = { couple_id: coupleId, paywall_unlocked: false, unlocked_at: null };
    mockDb.clientAccess.findByClientAndCouple.mockResolvedValue(accessRecord);
    mockDb.couples.findById.mockResolvedValue({ ...couple });

    const { status, body } = await request('GET', `/api/couples/${coupleId}`);

    expect(status).toBe(200);
    expect(body.couple.client_access).toEqual(accessRecord);
    // findByClientAndCouple called twice: once for access check, once to attach info
    expect(mockDb.clientAccess.findByClientAndCouple).toHaveBeenCalledTimes(2);
    expect(mockDb.clientAccess.findByClientAndCouple).toHaveBeenCalledWith('client-1', coupleId);
  });

  it('returns 403 for client with no access record', async () => {
    mockUser = { id: 'client-1', role: 'client' };
    mockDb.clientAccess.findByClientAndCouple.mockResolvedValue(null);

    const { status, body } = await request('GET', `/api/couples/${coupleId}`);

    expect(status).toBe(403);
    expect(body.error).toBe('Access denied to this couple');
    expect(mockDb.couples.findById).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid UUID param', async () => {
    const { status, body } = await request('GET', '/api/couples/not-a-uuid');

    expect(status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 500 when couples.findById throws', async () => {
    mockDb.couples.findById.mockRejectedValue(new Error('db error'));

    const { status, body } = await request('GET', `/api/couples/${coupleId}`);

    expect(status).toBe(500);
    expect(body.error).toBe('Server error');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/couples/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/couples/:id', () => {
  const coupleId = '90dd6d7f-20bb-4e1c-99e6-ccadb31bd8ec';

  it('deletes couple and returns success message', async () => {
    mockDb.couples.findByIdSimple.mockResolvedValue({ id: coupleId });
    mockDb.couples.delete.mockResolvedValue();

    const { status, body } = await request('DELETE', `/api/couples/${coupleId}`);

    expect(status).toBe(200);
    expect(body).toEqual({ message: 'Couple deleted successfully' });
    expect(mockDb.couples.delete).toHaveBeenCalledWith(coupleId);
  });

  it('returns 404 when couple does not exist', async () => {
    mockDb.couples.findByIdSimple.mockResolvedValue(null);

    const { status, body } = await request('DELETE', `/api/couples/${coupleId}`);

    expect(status).toBe(404);
    expect(body.error).toBe('Couple not found');
    expect(mockDb.couples.delete).not.toHaveBeenCalled();
  });

  it('returns 500 when couples.delete throws', async () => {
    mockDb.couples.findByIdSimple.mockResolvedValue({ id: coupleId });
    mockDb.couples.delete.mockRejectedValue(new Error('delete failed'));

    const { status, body } = await request('DELETE', `/api/couples/${coupleId}`);

    expect(status).toBe(500);
    expect(body.error).toBe('Failed to delete couple');
  });

  it('returns 403 when called by non-admin', async () => {
    mockUser = { id: 'client-1', role: 'client' };

    const { status } = await request('DELETE', `/api/couples/${coupleId}`);

    expect(status).toBe(403);
    expect(mockDb.couples.delete).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid UUID param', async () => {
    const { status, body } = await request('DELETE', '/api/couples/bad-id');

    expect(status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });
});

// ---------------------------------------------------------------------------
// POST /api/couples/:id/access
// ---------------------------------------------------------------------------
describe('POST /api/couples/:id/access', () => {
  const coupleId = '8add9e2e-95d7-432e-9a3d-36e9c6e624fe';
  const clientUserId = 'a4d5b511-7058-47a6-89e2-8fc1272821a1';
  const accessRecord = { client_user_id: clientUserId, couple_id: coupleId, paywall_unlocked: false };

  it('grants access and returns the upserted record', async () => {
    mockDb.couples.findByIdSimple.mockResolvedValue({ id: coupleId });
    mockDb.users.findByIdAndRole.mockResolvedValue({ id: clientUserId, role: 'client' });
    mockDb.clientAccess.upsert.mockResolvedValue(accessRecord);

    const { status, body } = await request('POST', `/api/couples/${coupleId}/access`, {
      client_user_id: clientUserId,
    });

    expect(status).toBe(200);
    expect(body).toEqual({ access: accessRecord });
    expect(mockDb.clientAccess.upsert).toHaveBeenCalledWith({
      client_user_id: clientUserId,
      couple_id: coupleId,
      paywall_unlocked: false,
    });
  });

  it('returns 400 when client_user_id is missing', async () => {
    const { status, body } = await request('POST', `/api/couples/${coupleId}/access`, {});

    expect(status).toBe(400);
    expect(body.error).toBe('client_user_id required');
    expect(mockDb.couples.findByIdSimple).not.toHaveBeenCalled();
  });

  it('returns 404 when couple does not exist', async () => {
    mockDb.couples.findByIdSimple.mockResolvedValue(null);

    const { status, body } = await request('POST', `/api/couples/${coupleId}/access`, {
      client_user_id: clientUserId,
    });

    expect(status).toBe(404);
    expect(body.error).toBe('Couple not found');
    expect(mockDb.users.findByIdAndRole).not.toHaveBeenCalled();
  });

  it('returns 404 when client user does not exist or is not a client', async () => {
    mockDb.couples.findByIdSimple.mockResolvedValue({ id: coupleId });
    mockDb.users.findByIdAndRole.mockResolvedValue(null);

    const { status, body } = await request('POST', `/api/couples/${coupleId}/access`, {
      client_user_id: clientUserId,
    });

    expect(status).toBe(404);
    expect(body.error).toBe('Client user not found');
    expect(mockDb.clientAccess.upsert).not.toHaveBeenCalled();
  });

  it('returns 500 when upsert throws', async () => {
    mockDb.couples.findByIdSimple.mockResolvedValue({ id: coupleId });
    mockDb.users.findByIdAndRole.mockResolvedValue({ id: clientUserId, role: 'client' });
    mockDb.clientAccess.upsert.mockRejectedValue(new Error('upsert failed'));

    const { status, body } = await request('POST', `/api/couples/${coupleId}/access`, {
      client_user_id: clientUserId,
    });

    expect(status).toBe(500);
    expect(body.error).toBe('Failed to grant access');
  });

  it('returns 403 when called by non-admin', async () => {
    mockUser = { id: 'client-1', role: 'client' };

    const { status } = await request('POST', `/api/couples/${coupleId}/access`, {
      client_user_id: clientUserId,
    });

    expect(status).toBe(403);
    expect(mockDb.clientAccess.upsert).not.toHaveBeenCalled();
  });

  it('calls users.findByIdAndRole with id and "client" role', async () => {
    mockDb.couples.findByIdSimple.mockResolvedValue({ id: coupleId });
    mockDb.users.findByIdAndRole.mockResolvedValue({ id: clientUserId, role: 'client' });
    mockDb.clientAccess.upsert.mockResolvedValue(accessRecord);

    await request('POST', `/api/couples/${coupleId}/access`, { client_user_id: clientUserId });

    expect(mockDb.users.findByIdAndRole).toHaveBeenCalledWith(clientUserId, 'client');
  });
});
