'use strict';

// ---------------------------------------------------------------------------
// Mock all external dependencies before requiring the router
// ---------------------------------------------------------------------------

const mockPromptTemplates = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../db', () => ({
  promptTemplates: mockPromptTemplates,
}));

const mockUploadImage = jest.fn();
const MOCK_BUCKETS = {
  REFERENCE_IMAGES: 'reference-images',
  IRIS_UPLOADS: 'iris-uploads',
  GENERATED_RESULTS: 'generated-results',
};

jest.mock('../../services/storageFactory', () => ({
  uploadImage: mockUploadImage,
  BUCKETS: MOCK_BUCKETS,
}));

const mockNanoBanana = {
  generateReferenceImage: jest.fn(),
  buildIrisPrompt: jest.fn(),
  generateImage: jest.fn(),
};

jest.mock('../../services/nanoBanana', () => mockNanoBanana);

// Bypass auth middleware — inject req.user before handler runs
jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
}));

// Bypass express-validator middleware chains
jest.mock('../../utils/validation', () => ({
  templateValidation: {
    create: (req, res, next) => next(),
    update: (req, res, next) => next(),
    idParam: (req, res, next) => next(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const express = require('express');
const http = require('http');

const router = require('../templates');

/**
 * Creates an express app wrapping the templates router.
 * Injects req.user so the mocked auth middleware has something to work with.
 */
function buildApp(userRole = 'admin') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-uuid-1', role: userRole };
    next();
  });
  app.use('/', router);
  return app;
}

/**
 * Minimal HTTP test client — avoids supertest dependency.
 * Opens a real server on an ephemeral port, fires one request, closes it.
 */
function req(app, method, path, body = null) {
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
      const httpReq = http.request(options, (httpRes) => {
        let raw = '';
        httpRes.on('data', (chunk) => (raw += chunk));
        httpRes.on('end', () => {
          server.close();
          let parsed;
          try { parsed = JSON.parse(raw); } catch { parsed = raw; }
          resolve({ status: httpRes.statusCode, body: parsed });
        });
      });
      httpReq.on('error', (err) => { server.close(); reject(err); });
      if (body !== null) httpReq.write(JSON.stringify(body));
      httpReq.end();
    });
  });
}

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// GET / — list templates
// ---------------------------------------------------------------------------

describe('GET / — list templates', () => {
  it('returns all templates for admin (activeOnly=false)', async () => {
    const templates = [{ id: '1', name: 'T1' }, { id: '2', name: 'T2', is_active: false }];
    mockPromptTemplates.findAll.mockResolvedValue(templates);

    const res = await req(buildApp('admin'), 'GET', '/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ templates });
    expect(mockPromptTemplates.findAll).toHaveBeenCalledWith({ activeOnly: false });
  });

  it('returns only active templates for non-admin (activeOnly=true)', async () => {
    const templates = [{ id: '2', name: 'T2', is_active: true }];
    mockPromptTemplates.findAll.mockResolvedValue(templates);

    const res = await req(buildApp('client'), 'GET', '/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ templates });
    expect(mockPromptTemplates.findAll).toHaveBeenCalledWith({ activeOnly: true });
  });

  it('returns empty array when repository returns []', async () => {
    mockPromptTemplates.findAll.mockResolvedValue([]);

    const res = await req(buildApp('admin'), 'GET', '/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ templates: [] });
  });

  it('returns 500 when findAll throws', async () => {
    mockPromptTemplates.findAll.mockRejectedValue(new Error('DB unreachable'));

    const res = await req(buildApp('admin'), 'GET', '/');

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Server error' });
  });
});

// ---------------------------------------------------------------------------
// POST / — create template
// ---------------------------------------------------------------------------

describe('POST / — create template', () => {
  it('creates template and returns 201 with the created record', async () => {
    const created = { id: 'tpl-new', name: 'My Template', prompt_text: 'eye art', is_active: true };
    mockPromptTemplates.create.mockResolvedValue(created);

    const res = await req(buildApp('admin'), 'POST', '/', {
      name: 'My Template',
      prompt_text: 'eye art',
      is_active: true,
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ template: created });
  });

  it('passes is_active=true by default when body omits it', async () => {
    mockPromptTemplates.create.mockResolvedValue({ id: 'x', name: 'T', prompt_text: 'p', is_active: true });

    await req(buildApp('admin'), 'POST', '/', { name: 'T', prompt_text: 'p' });

    const callArg = mockPromptTemplates.create.mock.calls[0][0];
    expect(callArg.is_active).toBe(true);
  });

  it('forwards all provided fields to create', async () => {
    mockPromptTemplates.create.mockResolvedValue({});

    await req(buildApp('admin'), 'POST', '/', {
      name: 'N',
      description: 'D',
      prompt_text: 'P',
      category: 'wedding',
      is_active: false,
    });

    expect(mockPromptTemplates.create).toHaveBeenCalledWith({
      name: 'N',
      description: 'D',
      prompt_text: 'P',
      category: 'wedding',
      is_active: false,
    });
  });

  it('returns 500 when create throws', async () => {
    mockPromptTemplates.create.mockRejectedValue(new Error('write error'));

    const res = await req(buildApp('admin'), 'POST', '/', { name: 'T', prompt_text: 'p' });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Server error' });
  });
});

// ---------------------------------------------------------------------------
// PUT /:id — update template
// ---------------------------------------------------------------------------

describe('PUT /:id — update template', () => {
  it('updates and returns the template on success', async () => {
    const updated = { id: 'tpl-1', name: 'Updated Name', is_active: true };
    mockPromptTemplates.update.mockResolvedValue(updated);

    const res = await req(buildApp('admin'), 'PUT', '/tpl-1', { name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ template: updated });
    expect(mockPromptTemplates.update).toHaveBeenCalledWith('tpl-1', { name: 'Updated Name' });
  });

  it('only includes defined fields in the updates object (no undefined keys)', async () => {
    mockPromptTemplates.update.mockResolvedValue({ id: 'tpl-1', is_active: false });

    await req(buildApp('admin'), 'PUT', '/tpl-1', { is_active: false });

    const callArg = mockPromptTemplates.update.mock.calls[0][1];
    expect(callArg).toEqual({ is_active: false });
    expect(Object.keys(callArg)).not.toContain('name');
    expect(Object.keys(callArg)).not.toContain('description');
    expect(Object.keys(callArg)).not.toContain('prompt_text');
    expect(Object.keys(callArg)).not.toContain('category');
  });

  it('returns 404 when update returns null (row not found)', async () => {
    mockPromptTemplates.update.mockResolvedValue(null);

    const res = await req(buildApp('admin'), 'PUT', '/ghost-id', { name: 'X' });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Template not found' });
  });

  it('returns 500 when update throws', async () => {
    mockPromptTemplates.update.mockRejectedValue(new Error('DB failure'));

    const res = await req(buildApp('admin'), 'PUT', '/tpl-1', { name: 'X' });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Server error' });
  });
});

// ---------------------------------------------------------------------------
// DELETE /:id — delete template
// ---------------------------------------------------------------------------

describe('DELETE /:id — delete template', () => {
  it('deletes and returns success message', async () => {
    mockPromptTemplates.delete.mockResolvedValue(undefined);

    const res = await req(buildApp('admin'), 'DELETE', '/tpl-1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: 'Template deleted successfully' });
    expect(mockPromptTemplates.delete).toHaveBeenCalledWith('tpl-1');
  });

  it('returns 500 when delete throws', async () => {
    mockPromptTemplates.delete.mockRejectedValue(new Error('constraint violation'));

    const res = await req(buildApp('admin'), 'DELETE', '/tpl-1');

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Server error' });
  });
});

// ---------------------------------------------------------------------------
// POST /:id/reference — generate reference image
// ---------------------------------------------------------------------------

describe('POST /:id/reference — generate reference image', () => {
  const TPL_ID = 'tpl-ref-1';
  const TEMPLATE = { id: TPL_ID, name: 'Ref Tpl', prompt_text: 'cosmic eye art' };
  const PUBLIC_URL = 'https://cdn.example.com/reference-images/reference-tpl-ref-1-uuid.png';

  beforeEach(() => {
    // Default: everything succeeds
    mockPromptTemplates.findById.mockResolvedValue(TEMPLATE);
    mockNanoBanana.generateReferenceImage.mockResolvedValue(Buffer.from('fake-png-bytes'));
    mockUploadImage.mockResolvedValue(PUBLIC_URL);
    mockPromptTemplates.update.mockResolvedValue({ ...TEMPLATE, reference_image_url: PUBLIC_URL });
  });

  it('returns updated template and public URL on full success', async () => {
    const res = await req(buildApp('admin'), 'POST', `/${TPL_ID}/reference`);

    expect(res.status).toBe(200);
    expect(res.body.reference_image_url).toBe(PUBLIC_URL);
    expect(res.body.template).toMatchObject({ id: TPL_ID, reference_image_url: PUBLIC_URL });
  });

  it('generates image with the template prompt_text', async () => {
    await req(buildApp('admin'), 'POST', `/${TPL_ID}/reference`);

    expect(mockNanoBanana.generateReferenceImage).toHaveBeenCalledWith(TEMPLATE.prompt_text);
  });

  it('uploads to REFERENCE_IMAGES bucket with filename containing template id', async () => {
    await req(buildApp('admin'), 'POST', `/${TPL_ID}/reference`);

    expect(mockUploadImage).toHaveBeenCalledWith(
      MOCK_BUCKETS.REFERENCE_IMAGES,
      expect.stringMatching(new RegExp(`^reference-${TPL_ID}-`)),
      expect.any(Buffer),
      'image/png'
    );
  });

  it('updates template with reference_image_url after upload', async () => {
    await req(buildApp('admin'), 'POST', `/${TPL_ID}/reference`);

    expect(mockPromptTemplates.update).toHaveBeenCalledWith(TPL_ID, { reference_image_url: PUBLIC_URL });
  });

  it('returns 404 when template is not found', async () => {
    mockPromptTemplates.findById.mockResolvedValue(null);

    const res = await req(buildApp('admin'), 'POST', '/no-such-id/reference');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Template not found' });
    // Nothing else should be called after a 404
    expect(mockNanoBanana.generateReferenceImage).not.toHaveBeenCalled();
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  it('returns 502 when AI generation fails', async () => {
    mockNanoBanana.generateReferenceImage.mockRejectedValue(new Error('Quota exceeded'));

    const res = await req(buildApp('admin'), 'POST', `/${TPL_ID}/reference`);

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/AI generation failed/);
    expect(res.body.error).toMatch(/Quota exceeded/);
    // Should not attempt upload
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  it('returns 500 when storage upload fails', async () => {
    mockUploadImage.mockRejectedValue(new Error('Bucket unavailable'));

    const res = await req(buildApp('admin'), 'POST', `/${TPL_ID}/reference`);

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to store reference image/);
    expect(res.body.error).toMatch(/Bucket unavailable/);
    // Should not attempt template update
    expect(mockPromptTemplates.update).not.toHaveBeenCalled();
  });

  it('returns 500 when template update after upload returns null', async () => {
    mockPromptTemplates.update.mockResolvedValue(null);

    const res = await req(buildApp('admin'), 'POST', `/${TPL_ID}/reference`);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Failed to update template reference URL' });
  });

  it('returns 500 when template update after upload throws', async () => {
    mockPromptTemplates.update.mockRejectedValue(new Error('write conflict'));

    const res = await req(buildApp('admin'), 'POST', `/${TPL_ID}/reference`);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Server error during reference generation' });
  });
});
