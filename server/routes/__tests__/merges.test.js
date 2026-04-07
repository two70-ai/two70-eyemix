'use strict';

// ---------------------------------------------------------------------------
// Mock all external dependencies before requiring the router
// ---------------------------------------------------------------------------

const mockMerges = {
  findAll: jest.fn(),
  findAllByCoupleIds: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateWithJoins: jest.fn(),
  delete: jest.fn(),
};
const mockCouples = { findByIdSimple: jest.fn() };
const mockPromptTemplates = { findByIdActive: jest.fn() };
const mockClientAccess = {
  findUnlockedCoupleIdsByClient: jest.fn(),
  findByClientAndCouple: jest.fn(),
};

jest.mock('../../db', () => ({
  merges: mockMerges,
  couples: mockCouples,
  promptTemplates: mockPromptTemplates,
  clientAccess: mockClientAccess,
}));

const mockUploadImage = jest.fn();
const MOCK_BUCKETS = {
  IRIS_UPLOADS: 'iris-uploads',
  GENERATED_RESULTS: 'generated-results',
  REFERENCE_IMAGES: 'reference-images',
};

jest.mock('../../services/storageFactory', () => ({
  uploadImage: mockUploadImage,
  BUCKETS: MOCK_BUCKETS,
}));

const mockNanoBanana = {
  buildIrisPrompt: jest.fn(),
  generateImage: jest.fn(),
  generateReferenceImage: jest.fn(),
};

jest.mock('../../services/nanoBanana', () => mockNanoBanana);

// Bypass auth middleware — user injected by buildApp
jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
}));

// Bypass validation middleware
jest.mock('../../utils/validation', () => ({
  mergeValidation: {
    create: (req, res, next) => next(),
    idParam: (req, res, next) => next(),
  },
}));

// Bypass multer upload middleware
jest.mock('../../middleware/upload', () => ({
  upload: {
    fields: () => (req, res, next) => {
      // Tests set req.files before calling the endpoint via the fileInjector middleware
      next();
    },
  },
  handleUploadError: (req, res, next) => next(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const express = require('express');
const http = require('http');

const router = require('../merges');

/**
 * Creates a test express app.
 * @param {string} userRole  - 'admin' | 'client' | 'staff'
 * @param {object} files     - multer-style req.files object (for POST /)
 */
function buildApp(userRole = 'admin', files = null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-uuid-1', role: userRole };
    if (files !== null) req.files = files;
    next();
  });
  app.use('/', router);
  return app;
}

/** Minimal HTTP test client using Node's built-in http module. */
function httpReq(app, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const options = {
        hostname: '127.0.0.1',
        port,
        path,
        method: method.toUpperCase(),
        headers: { 'Content-Type': 'application/json' },
      };
      const httpRequest = http.request(options, (httpRes) => {
        let raw = '';
        httpRes.on('data', (chunk) => (raw += chunk));
        httpRes.on('end', () => {
          server.close();
          let parsed;
          try { parsed = JSON.parse(raw); } catch { parsed = raw; }
          resolve({ status: httpRes.statusCode, body: parsed });
        });
      });
      httpRequest.on('error', (err) => { server.close(); reject(err); });
      if (body !== null) httpRequest.write(JSON.stringify(body));
      httpRequest.end();
    });
  });
}

/** Builds a minimal fake multer file object. */
function fakeFile(name = 'eye.jpg', mimetype = 'image/jpeg') {
  return { originalname: name, mimetype, buffer: Buffer.from('fake-image') };
}

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// GET / — list merges
// ---------------------------------------------------------------------------

describe('GET / — list merges', () => {
  it('returns all merges for admin', async () => {
    const data = [{ id: 'm1' }, { id: 'm2' }];
    mockMerges.findAll.mockResolvedValue(data);

    const res = await httpReq(buildApp('admin'), 'GET', '/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ merges: data });
    expect(mockMerges.findAll).toHaveBeenCalled();
    expect(mockClientAccess.findUnlockedCoupleIdsByClient).not.toHaveBeenCalled();
  });

  it('returns empty array for client with no unlocked couples', async () => {
    mockClientAccess.findUnlockedCoupleIdsByClient.mockResolvedValue([]);

    const res = await httpReq(buildApp('client'), 'GET', '/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ merges: [] });
    expect(mockMerges.findAllByCoupleIds).not.toHaveBeenCalled();
  });

  it('returns merges filtered by unlocked couple IDs for client', async () => {
    mockClientAccess.findUnlockedCoupleIdsByClient.mockResolvedValue(['c1', 'c2']);
    const data = [{ id: 'm1', couple_id: 'c1' }];
    mockMerges.findAllByCoupleIds.mockResolvedValue(data);

    const res = await httpReq(buildApp('client'), 'GET', '/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ merges: data });
    expect(mockMerges.findAllByCoupleIds).toHaveBeenCalledWith(['c1', 'c2']);
  });

  it('returns 500 when findAll throws for admin', async () => {
    mockMerges.findAll.mockRejectedValue(new Error('DB down'));

    const res = await httpReq(buildApp('admin'), 'GET', '/');

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Server error' });
  });

  it('returns 500 when clientAccess lookup throws', async () => {
    mockClientAccess.findUnlockedCoupleIdsByClient.mockRejectedValue(new Error('access error'));

    const res = await httpReq(buildApp('client'), 'GET', '/');

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Server error' });
  });
});

// ---------------------------------------------------------------------------
// POST / — create merge
// ---------------------------------------------------------------------------

describe('POST / — create merge', () => {
  const COUPLE = { id: 'couple-1', person_a_name: 'Alice', person_b_name: 'Bob' };
  const TEMPLATE = { id: 'tpl-1', name: 'T', prompt_text: 'eye art' };
  const IRIS_FILES = {
    iris_a: [fakeFile('iris_a.jpg')],
    iris_b: [fakeFile('iris_b.jpg')],
  };

  beforeEach(() => {
    mockCouples.findByIdSimple.mockResolvedValue(COUPLE);
    mockPromptTemplates.findByIdActive.mockResolvedValue(TEMPLATE);
    mockUploadImage.mockResolvedValue('https://storage.example.com/iris.jpg');
    mockNanoBanana.buildIrisPrompt.mockReturnValue('full prompt text');
    mockNanoBanana.generateImage.mockResolvedValue(Buffer.from('result-image'));
    mockMerges.create.mockResolvedValue({ id: 'merge-uuid', status: 'pending' });
    mockMerges.updateWithJoins.mockResolvedValue({
      id: 'merge-uuid',
      status: 'completed',
      result_image_url: 'https://storage.example.com/result.png',
      couples: COUPLE,
      prompt_templates: TEMPLATE,
    });
  });

  it('returns 400 when iris files are missing', async () => {
    const res = await httpReq(
      buildApp('admin', {}), // empty files
      'POST', '/',
      { couple_id: 'couple-1', template_id: 'tpl-1' }
    );

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Both iris_a and iris_b images are required' });
  });

  it('returns 404 when couple does not exist', async () => {
    mockCouples.findByIdSimple.mockResolvedValue(null);

    const res = await httpReq(
      buildApp('admin', IRIS_FILES),
      'POST', '/',
      { couple_id: 'no-couple', template_id: 'tpl-1' }
    );

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Couple not found' });
  });

  it('returns 404 when template is inactive or missing', async () => {
    mockPromptTemplates.findByIdActive.mockResolvedValue(null);

    const res = await httpReq(
      buildApp('admin', IRIS_FILES),
      'POST', '/',
      { couple_id: 'couple-1', template_id: 'inactive-tpl' }
    );

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Template not found or inactive' });
  });

  it('returns 500 when iris image upload fails', async () => {
    mockUploadImage.mockRejectedValue(new Error('storage error'));

    const res = await httpReq(
      buildApp('admin', IRIS_FILES),
      'POST', '/',
      { couple_id: 'couple-1', template_id: 'tpl-1' }
    );

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Failed to upload iris images' });
  });

  it('returns 502 on AI generation failure and marks merge as failed', async () => {
    mockNanoBanana.generateImage.mockRejectedValue(new Error('API down'));

    const res = await httpReq(
      buildApp('admin', IRIS_FILES),
      'POST', '/',
      { couple_id: 'couple-1', template_id: 'tpl-1' }
    );

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/AI generation failed/);
    // The merge ID is a runtime UUID — verify update was called with the same ID used at creation
    expect(mockMerges.update).toHaveBeenCalledWith(
      mockMerges.create.mock.calls[0][0].id,
      { status: 'failed' }
    );
  });

  it('returns 500 on result upload failure and marks merge as failed', async () => {
    // First two calls (iris_a, iris_b) succeed; third call (result) fails
    mockUploadImage
      .mockResolvedValueOnce('https://storage.example.com/iris_a.jpg')
      .mockResolvedValueOnce('https://storage.example.com/iris_b.jpg')
      .mockRejectedValueOnce(new Error('result bucket full'));

    const res = await httpReq(
      buildApp('admin', IRIS_FILES),
      'POST', '/',
      { couple_id: 'couple-1', template_id: 'tpl-1' }
    );

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Failed to store result image' });
    expect(mockMerges.update).toHaveBeenCalledWith(
      mockMerges.create.mock.calls[0][0].id,
      { status: 'failed' }
    );
  });

  it('creates merge record with correct fields', async () => {
    await httpReq(
      buildApp('admin', IRIS_FILES),
      'POST', '/',
      { couple_id: 'couple-1', template_id: 'tpl-1' }
    );

    const createArg = mockMerges.create.mock.calls[0][0];
    expect(createArg).toMatchObject({
      couple_id: 'couple-1',
      template_id: 'tpl-1',
      prompt_used: 'full prompt text',
      status: 'pending',
      created_by: 'user-uuid-1',
    });
    expect(typeof createArg.id).toBe('string');
    expect(createArg.id).toHaveLength(36); // UUID v4
  });

  it('calls updateWithJoins with completed status and returns 201', async () => {
    const res = await httpReq(
      buildApp('admin', IRIS_FILES),
      'POST', '/',
      { couple_id: 'couple-1', template_id: 'tpl-1' }
    );

    expect(res.status).toBe(201);
    // The merge ID is a runtime UUID — verify updateWithJoins was called with
    // the same ID used when the merge record was created
    const createdId = mockMerges.create.mock.calls[0][0].id;
    expect(mockMerges.updateWithJoins).toHaveBeenCalledWith(
      createdId,
      expect.objectContaining({ status: 'completed', result_image_url: expect.any(String) })
    );
    expect(res.body.merge.status).toBe('completed');
  });

  it('returns 500 when merges.create throws', async () => {
    mockMerges.create.mockRejectedValue(new Error('DB constraint'));

    const res = await httpReq(
      buildApp('admin', IRIS_FILES),
      'POST', '/',
      { couple_id: 'couple-1', template_id: 'tpl-1' }
    );

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Server error during merge creation' });
  });
});

// ---------------------------------------------------------------------------
// GET /:id — merge detail
// ---------------------------------------------------------------------------

describe('GET /:id — merge detail', () => {
  const MERGE = {
    id: 'merge-1',
    couple_id: 'couple-1',
    status: 'completed',
    couples: { id: 'couple-1', person_a_name: 'A', person_b_name: 'B' },
    prompt_templates: { id: 'tpl-1', name: 'T' },
  };

  it('returns merge for admin without access check', async () => {
    mockMerges.findById.mockResolvedValue(MERGE);

    const res = await httpReq(buildApp('admin'), 'GET', '/merge-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ merge: MERGE });
    expect(mockClientAccess.findByClientAndCouple).not.toHaveBeenCalled();
  });

  it('returns 404 when merge not found', async () => {
    mockMerges.findById.mockResolvedValue(null);

    const res = await httpReq(buildApp('admin'), 'GET', '/no-such-merge');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Merge not found' });
  });

  it('returns 403 for client with no access record', async () => {
    mockMerges.findById.mockResolvedValue(MERGE);
    mockClientAccess.findByClientAndCouple.mockResolvedValue(null);

    const res = await httpReq(buildApp('client'), 'GET', '/merge-1');

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Access denied' });
  });

  it('returns 402 for client when paywall is locked', async () => {
    mockMerges.findById.mockResolvedValue(MERGE);
    mockClientAccess.findByClientAndCouple.mockResolvedValue({
      couple_id: 'couple-1',
      paywall_unlocked: false,
    });

    const res = await httpReq(buildApp('client'), 'GET', '/merge-1');

    expect(res.status).toBe(402);
    expect(res.body.error).toMatch(/Paywall locked/);
  });

  it('returns merge for client when paywall is unlocked', async () => {
    mockMerges.findById.mockResolvedValue(MERGE);
    mockClientAccess.findByClientAndCouple.mockResolvedValue({
      couple_id: 'couple-1',
      paywall_unlocked: true,
    });

    const res = await httpReq(buildApp('client'), 'GET', '/merge-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ merge: MERGE });
  });

  it('checks access for the correct client and couple', async () => {
    mockMerges.findById.mockResolvedValue(MERGE);
    mockClientAccess.findByClientAndCouple.mockResolvedValue({ paywall_unlocked: true });

    await httpReq(buildApp('client'), 'GET', '/merge-1');

    expect(mockClientAccess.findByClientAndCouple).toHaveBeenCalledWith('user-uuid-1', 'couple-1');
  });

  it('returns 500 when findById throws', async () => {
    mockMerges.findById.mockRejectedValue(new Error('DB error'));

    const res = await httpReq(buildApp('admin'), 'GET', '/merge-1');

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Server error' });
  });
});

// ---------------------------------------------------------------------------
// DELETE /:id — delete merge
// ---------------------------------------------------------------------------

describe('DELETE /:id — delete merge', () => {
  it('deletes merge and returns success message', async () => {
    mockMerges.delete.mockResolvedValue(undefined);

    const res = await httpReq(buildApp('admin'), 'DELETE', '/merge-1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: 'Merge deleted successfully' });
    expect(mockMerges.delete).toHaveBeenCalledWith('merge-1');
  });

  it('returns 500 when delete throws', async () => {
    mockMerges.delete.mockRejectedValue(new Error('FK constraint'));

    const res = await httpReq(buildApp('admin'), 'DELETE', '/merge-1');

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Server error' });
  });
});
