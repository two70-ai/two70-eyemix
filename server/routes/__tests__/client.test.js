'use strict';

// ---------------------------------------------------------------------------
// Mock the db abstraction layer before any require of the route
// ---------------------------------------------------------------------------
const mockDb = {
  clientAccess: {
    findByClientAndCouple: jest.fn(),
    findAllByClient: jest.fn(),
    upsert: jest.fn(),
  },
  couples: {
    findByIdSimple: jest.fn(),
  },
  merges: {
    findAllByCoupleIdAndStatus: jest.fn(),
  },
};

jest.mock('../../db', () => mockDb);

// Mock auth middleware
let mockUser = { id: 'client-1', role: 'client' };

jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, _res, next) => { req.user = mockUser; next(); },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const clientRouter = require('../client');

// ---------------------------------------------------------------------------
// Test HTTP server helpers
// ---------------------------------------------------------------------------
let server;
let baseUrl;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/client', clientRouter);
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
  // Default to a client user
  mockUser = { id: 'client-1', role: 'client' };
});

// ---------------------------------------------------------------------------
// POST /api/client/unlock
// ---------------------------------------------------------------------------
describe('POST /api/client/unlock', () => {
  const coupleId = 'b8b99e7d-265f-400c-8ca4-ff661bc49ce2';
  const accessRecord = { client_user_id: 'client-1', couple_id: coupleId, paywall_unlocked: true };

  beforeEach(() => {
    // Set a deterministic paywall password for all unlock tests
    process.env.CLIENT_PAYWALL_PASSWORD = 'testpass';
  });

  afterEach(() => {
    delete process.env.CLIENT_PAYWALL_PASSWORD;
  });

  it('unlocks access and returns the upserted record', async () => {
    mockDb.couples.findByIdSimple.mockResolvedValue({ id: coupleId });
    mockDb.clientAccess.upsert.mockResolvedValue(accessRecord);

    const { status, body } = await request('POST', '/api/client/unlock', {
      password: 'testpass',
      couple_id: coupleId,
    });

    expect(status).toBe(200);
    expect(body.message).toBe('Access unlocked successfully');
    expect(body.access).toEqual(accessRecord);
    expect(mockDb.clientAccess.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_user_id: 'client-1',
        couple_id: coupleId,
        paywall_unlocked: true,
      })
    );
  });

  it('upsert payload includes unlocked_at as ISO string', async () => {
    mockDb.couples.findByIdSimple.mockResolvedValue({ id: coupleId });
    mockDb.clientAccess.upsert.mockResolvedValue(accessRecord);

    await request('POST', '/api/client/unlock', {
      password: 'testpass',
      couple_id: coupleId,
    });

    const call = mockDb.clientAccess.upsert.mock.calls[0][0];
    expect(typeof call.unlocked_at).toBe('string');
    // Must parse as a valid date
    expect(isNaN(Date.parse(call.unlocked_at))).toBe(false);
  });

  it('returns 401 for wrong password', async () => {
    const { status, body } = await request('POST', '/api/client/unlock', {
      password: 'wrongpass',
      couple_id: coupleId,
    });

    expect(status).toBe(401);
    expect(body.error).toBe('Incorrect password');
    expect(mockDb.couples.findByIdSimple).not.toHaveBeenCalled();
  });

  it('returns 404 when couple does not exist', async () => {
    mockDb.couples.findByIdSimple.mockResolvedValue(null);

    const { status, body } = await request('POST', '/api/client/unlock', {
      password: 'testpass',
      couple_id: coupleId,
    });

    expect(status).toBe(404);
    expect(body.error).toBe('Couple not found');
    expect(mockDb.clientAccess.upsert).not.toHaveBeenCalled();
  });

  it('returns 500 when upsert throws', async () => {
    mockDb.couples.findByIdSimple.mockResolvedValue({ id: coupleId });
    mockDb.clientAccess.upsert.mockRejectedValue(new Error('upsert failed'));

    const { status, body } = await request('POST', '/api/client/unlock', {
      password: 'testpass',
      couple_id: coupleId,
    });

    expect(status).toBe(500);
    expect(body.error).toBe('Failed to unlock access');
  });

  it('returns 400 when couple_id is missing (validation)', async () => {
    const { status, body } = await request('POST', '/api/client/unlock', {
      password: 'testpass',
    });

    expect(status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(mockDb.couples.findByIdSimple).not.toHaveBeenCalled();
  });

  it('returns 400 when password is missing (validation)', async () => {
    const { status, body } = await request('POST', '/api/client/unlock', {
      couple_id: coupleId,
    });

    expect(status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(mockDb.couples.findByIdSimple).not.toHaveBeenCalled();
  });

  it('falls back to default password when env var is not set', async () => {
    delete process.env.CLIENT_PAYWALL_PASSWORD;
    mockDb.couples.findByIdSimple.mockResolvedValue({ id: coupleId });
    mockDb.clientAccess.upsert.mockResolvedValue(accessRecord);

    const { status } = await request('POST', '/api/client/unlock', {
      password: 'iloveaiimages',
      couple_id: coupleId,
    });

    expect(status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/client/access
// ---------------------------------------------------------------------------
describe('GET /api/client/access', () => {
  it('returns all access records for the current client', async () => {
    const records = [
      { couple_id: 'c1', paywall_unlocked: true, couples: { id: 'c1', person_a_name: 'A', person_b_name: 'B' } },
    ];
    mockDb.clientAccess.findAllByClient.mockResolvedValue(records);

    const { status, body } = await request('GET', '/api/client/access');

    expect(status).toBe(200);
    expect(body).toEqual({ access: records });
    expect(mockDb.clientAccess.findAllByClient).toHaveBeenCalledWith('client-1');
  });

  it('returns empty array when client has no access records', async () => {
    mockDb.clientAccess.findAllByClient.mockResolvedValue([]);

    const { status, body } = await request('GET', '/api/client/access');

    expect(status).toBe(200);
    expect(body).toEqual({ access: [] });
  });

  it('returns 500 when findAllByClient throws', async () => {
    mockDb.clientAccess.findAllByClient.mockRejectedValue(new Error('db error'));

    const { status, body } = await request('GET', '/api/client/access');

    expect(status).toBe(500);
    expect(body.error).toBe('Server error');
  });
});

// ---------------------------------------------------------------------------
// GET /api/client/merges/:coupleId
// ---------------------------------------------------------------------------
describe('GET /api/client/merges/:coupleId', () => {
  const coupleId = '90dd6d7f-20bb-4e1c-99e6-ccadb31bd8ec';

  it('returns completed merges when paywall is unlocked', async () => {
    const mergesList = [{ id: 'm1', status: 'completed', prompt_templates: { id: 't1' } }];
    mockDb.clientAccess.findByClientAndCouple.mockResolvedValue({
      paywall_unlocked: true,
    });
    mockDb.merges.findAllByCoupleIdAndStatus.mockResolvedValue(mergesList);

    const { status, body } = await request('GET', `/api/client/merges/${coupleId}`);

    expect(status).toBe(200);
    expect(body).toEqual({ merges: mergesList });
    expect(mockDb.clientAccess.findByClientAndCouple).toHaveBeenCalledWith('client-1', coupleId);
    expect(mockDb.merges.findAllByCoupleIdAndStatus).toHaveBeenCalledWith(coupleId, 'completed');
  });

  it('returns empty merges array when none exist', async () => {
    mockDb.clientAccess.findByClientAndCouple.mockResolvedValue({ paywall_unlocked: true });
    mockDb.merges.findAllByCoupleIdAndStatus.mockResolvedValue([]);

    const { status, body } = await request('GET', `/api/client/merges/${coupleId}`);

    expect(status).toBe(200);
    expect(body).toEqual({ merges: [] });
  });

  it('returns 403 when client has no access record at all', async () => {
    mockDb.clientAccess.findByClientAndCouple.mockResolvedValue(null);

    const { status, body } = await request('GET', `/api/client/merges/${coupleId}`);

    expect(status).toBe(403);
    expect(body.error).toBe('No access to this couple');
    expect(mockDb.merges.findAllByCoupleIdAndStatus).not.toHaveBeenCalled();
  });

  it('returns 402 when paywall is locked', async () => {
    mockDb.clientAccess.findByClientAndCouple.mockResolvedValue({ paywall_unlocked: false });

    const { status, body } = await request('GET', `/api/client/merges/${coupleId}`);

    expect(status).toBe(402);
    expect(body.error).toBe('Paywall locked');
    expect(body.requiresUnlock).toBe(true);
    expect(mockDb.merges.findAllByCoupleIdAndStatus).not.toHaveBeenCalled();
  });

  it('returns 500 when findAllByCoupleIdAndStatus throws', async () => {
    mockDb.clientAccess.findByClientAndCouple.mockResolvedValue({ paywall_unlocked: true });
    mockDb.merges.findAllByCoupleIdAndStatus.mockRejectedValue(new Error('db error'));

    const { status, body } = await request('GET', `/api/client/merges/${coupleId}`);

    expect(status).toBe(500);
    expect(body.error).toBe('Failed to fetch results');
  });

  it('returns 500 when findByClientAndCouple throws', async () => {
    mockDb.clientAccess.findByClientAndCouple.mockRejectedValue(new Error('db error'));

    const { status, body } = await request('GET', `/api/client/merges/${coupleId}`);

    expect(status).toBe(500);
    expect(body.error).toBe('Server error');
  });
});
