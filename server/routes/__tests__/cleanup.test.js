'use strict';

// ---------------------------------------------------------------------------
// Mock all external dependencies before requiring the router
// ---------------------------------------------------------------------------

const mockMerges = {
  findOlderThan: jest.fn(),
  deleteByIds: jest.fn(),
  countOlderThan: jest.fn(),
  countAll: jest.fn(),
};

jest.mock('../../db', () => ({
  merges: mockMerges,
}));

const mockListOldImages = jest.fn();
const mockDeleteImages = jest.fn();
const mockExtractFilenameFromUrl = jest.fn();
const MOCK_BUCKETS = {
  IRIS_UPLOADS: 'iris-uploads',
  GENERATED_RESULTS: 'generated-results',
  REFERENCE_IMAGES: 'reference-images',
};

jest.mock('../../services/storageFactory', () => ({
  listOldImages: mockListOldImages,
  deleteImages: mockDeleteImages,
  extractFilenameFromUrl: mockExtractFilenameFromUrl,
  BUCKETS: MOCK_BUCKETS,
}));

// Bypass auth middleware
jest.mock('../../middleware/auth', () => ({
  requireAdmin: (req, res, next) => next(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const express = require('express');
const http = require('http');

const router = require('../cleanup');

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

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no old images in storage
  mockListOldImages.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// POST / — cleanup
// ---------------------------------------------------------------------------

describe('POST / — cleanup', () => {
  it('returns 200 with zero deletions when no old merges exist', async () => {
    mockMerges.findOlderThan.mockResolvedValue([]);

    const res = await httpReq(buildApp(), 'POST', '/', { days_old: 30 });

    expect(res.status).toBe(200);
    expect(res.body.results.deleted_merges).toBe(0);
    expect(res.body.results.deleted_files).toHaveLength(0);
    expect(res.body.results.errors).toHaveLength(0);
  });

  it('defaults to 30 days when days_old is not provided', async () => {
    mockMerges.findOlderThan.mockResolvedValue([]);

    const res = await httpReq(buildApp(), 'POST', '/');

    expect(res.status).toBe(200);
    expect(res.body.days_old).toBe(30);
  });

  it('respects a custom days_old value', async () => {
    mockMerges.findOlderThan.mockResolvedValue([]);

    const res = await httpReq(buildApp(), 'POST', '/', { days_old: 7 });

    expect(res.body.days_old).toBe(7);
  });

  it('passes correct statuses to findOlderThan', async () => {
    mockMerges.findOlderThan.mockResolvedValue([]);

    await httpReq(buildApp(), 'POST', '/', { days_old: 30 });

    expect(mockMerges.findOlderThan).toHaveBeenCalledWith(
      expect.any(String), // ISO cutoff date
      ['completed', 'failed']
    );
  });

  it('deletes storage files and merge records for old merges', async () => {
    const oldMerge = {
      id: 'merge-old-1',
      iris_a_url: 'https://cdn.example.com/iris-uploads/merge-old-1/iris_a.jpg',
      iris_b_url: 'https://cdn.example.com/iris-uploads/merge-old-1/iris_b.jpg',
      result_image_url: 'https://cdn.example.com/generated-results/merge-old-1/result.png',
      status: 'completed',
    };
    mockMerges.findOlderThan.mockResolvedValue([oldMerge]);
    mockExtractFilenameFromUrl
      .mockReturnValueOnce('merge-old-1/iris_a.jpg')
      .mockReturnValueOnce('merge-old-1/iris_b.jpg')
      .mockReturnValueOnce('merge-old-1/result.png');
    mockDeleteImages.mockResolvedValue(undefined);
    mockMerges.deleteByIds.mockResolvedValue(undefined);

    const res = await httpReq(buildApp(), 'POST', '/', { days_old: 30 });

    expect(res.status).toBe(200);
    expect(mockDeleteImages).toHaveBeenCalledWith(
      MOCK_BUCKETS.IRIS_UPLOADS,
      ['merge-old-1/iris_a.jpg', 'merge-old-1/iris_b.jpg']
    );
    expect(mockDeleteImages).toHaveBeenCalledWith(
      MOCK_BUCKETS.GENERATED_RESULTS,
      ['merge-old-1/result.png']
    );
    expect(mockMerges.deleteByIds).toHaveBeenCalledWith(['merge-old-1']);
    expect(res.body.results.deleted_merges).toBe(1);
  });

  it('skips iris storage delete when extractFilenameFromUrl returns null', async () => {
    const oldMerge = {
      id: 'merge-2',
      iris_a_url: 'https://cdn.example.com/iris-uploads/merge-2/iris_a.jpg',
      iris_b_url: null,
      result_image_url: null,
      status: 'failed',
    };
    mockMerges.findOlderThan.mockResolvedValue([oldMerge]);
    // extractFilenameFromUrl returns null for iris_a (e.g. external URL)
    mockExtractFilenameFromUrl.mockReturnValueOnce(null);
    mockMerges.deleteByIds.mockResolvedValue(undefined);

    const res = await httpReq(buildApp(), 'POST', '/', { days_old: 30 });

    expect(res.status).toBe(200);
    // deleteImages should NOT have been called (no valid filenames)
    expect(mockDeleteImages).not.toHaveBeenCalledWith(MOCK_BUCKETS.IRIS_UPLOADS, expect.anything());
    expect(res.body.results.deleted_merges).toBe(1);
  });

  it('records error but continues when findOlderThan throws (207 status)', async () => {
    mockMerges.findOlderThan.mockRejectedValue(new Error('DB unavailable'));

    const res = await httpReq(buildApp(), 'POST', '/', { days_old: 30 });

    expect(res.status).toBe(207);
    expect(res.body.results.errors).toHaveLength(1);
    expect(res.body.results.errors[0]).toMatch(/Failed to query old merges/);
    expect(res.body.results.errors[0]).toMatch(/DB unavailable/);
  });

  it('records error but continues when iris storage delete fails', async () => {
    const oldMerge = {
      id: 'merge-3',
      iris_a_url: 'https://cdn.example.com/iris-uploads/m3/iris_a.jpg',
      iris_b_url: null,
      result_image_url: null,
      status: 'completed',
    };
    mockMerges.findOlderThan.mockResolvedValue([oldMerge]);
    mockExtractFilenameFromUrl.mockReturnValue('m3/iris_a.jpg');
    mockDeleteImages.mockRejectedValue(new Error('storage error'));
    mockMerges.deleteByIds.mockResolvedValue(undefined);

    const res = await httpReq(buildApp(), 'POST', '/', { days_old: 30 });

    expect(res.status).toBe(207);
    expect(res.body.results.errors.some((e) => e.includes('Iris uploads delete error'))).toBe(true);
    // DB delete should still have been attempted
    expect(mockMerges.deleteByIds).toHaveBeenCalled();
  });

  it('records error but continues when result storage delete fails', async () => {
    const oldMerge = {
      id: 'merge-4',
      iris_a_url: null,
      iris_b_url: null,
      result_image_url: 'https://cdn.example.com/generated-results/m4/result.png',
      status: 'completed',
    };
    mockMerges.findOlderThan.mockResolvedValue([oldMerge]);
    mockExtractFilenameFromUrl.mockReturnValue('m4/result.png');
    mockDeleteImages.mockRejectedValue(new Error('bucket gone'));
    mockMerges.deleteByIds.mockResolvedValue(undefined);

    const res = await httpReq(buildApp(), 'POST', '/', { days_old: 30 });

    expect(res.status).toBe(207);
    expect(res.body.results.errors.some((e) => e.includes('Result images delete error'))).toBe(true);
  });

  it('records error when deleteByIds throws', async () => {
    const oldMerge = {
      id: 'merge-5',
      iris_a_url: null,
      iris_b_url: null,
      result_image_url: null,
      status: 'failed',
    };
    mockMerges.findOlderThan.mockResolvedValue([oldMerge]);
    mockMerges.deleteByIds.mockRejectedValue(new Error('FK violation'));

    const res = await httpReq(buildApp(), 'POST', '/', { days_old: 30 });

    expect(res.status).toBe(207);
    expect(res.body.results.errors.some((e) => e.includes('Failed to delete merge records'))).toBe(true);
    expect(res.body.results.deleted_merges).toBe(0);
  });

  it('deletes old reference images from storage', async () => {
    mockMerges.findOlderThan.mockResolvedValue([]);
    mockListOldImages.mockResolvedValue([{ name: 'reference-tpl-1-uuid.png' }]);
    mockDeleteImages.mockResolvedValue(undefined);

    const res = await httpReq(buildApp(), 'POST', '/', { days_old: 30 });

    expect(res.status).toBe(200);
    expect(mockListOldImages).toHaveBeenCalledWith(MOCK_BUCKETS.REFERENCE_IMAGES, 30);
    expect(mockDeleteImages).toHaveBeenCalledWith(
      MOCK_BUCKETS.REFERENCE_IMAGES,
      ['reference-tpl-1-uuid.png']
    );
    expect(res.body.results.deleted_reference_images).toBe(1);
  });

  it('records error but continues when reference image cleanup fails', async () => {
    mockMerges.findOlderThan.mockResolvedValue([]);
    mockListOldImages.mockRejectedValue(new Error('list error'));

    const res = await httpReq(buildApp(), 'POST', '/', { days_old: 30 });

    expect(res.status).toBe(207);
    expect(res.body.results.errors.some((e) => e.includes('Reference images cleanup error'))).toBe(true);
  });

  it('returns 200 (not 207) when everything succeeds with no errors', async () => {
    mockMerges.findOlderThan.mockResolvedValue([]);
    mockListOldImages.mockResolvedValue([]);

    const res = await httpReq(buildApp(), 'POST', '/');

    expect(res.status).toBe(200);
    expect(res.body.results.errors).toHaveLength(0);
  });

  it('includes cutoff_date in the response', async () => {
    mockMerges.findOlderThan.mockResolvedValue([]);

    const res = await httpReq(buildApp(), 'POST', '/', { days_old: 14 });

    expect(res.body).toHaveProperty('cutoff_date');
    expect(new Date(res.body.cutoff_date)).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// GET /stats — preview stats
// ---------------------------------------------------------------------------

describe('GET /stats — preview stats', () => {
  it('returns merge counts and cutoff date', async () => {
    mockMerges.countOlderThan.mockResolvedValue(5);
    mockMerges.countAll.mockResolvedValue(20);

    const res = await httpReq(buildApp(), 'GET', '/stats');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      merges_to_delete: 5,
      total_merges: 20,
      days_old: 30,
    });
    expect(res.body).toHaveProperty('cutoff_date');
  });

  it('defaults to 30 days when days_old query param is absent', async () => {
    mockMerges.countOlderThan.mockResolvedValue(0);
    mockMerges.countAll.mockResolvedValue(0);

    const res = await httpReq(buildApp(), 'GET', '/stats');

    expect(res.body.days_old).toBe(30);
  });

  it('uses custom days_old from query string', async () => {
    mockMerges.countOlderThan.mockResolvedValue(2);
    mockMerges.countAll.mockResolvedValue(10);

    const res = await httpReq(buildApp(), 'GET', '/stats?days_old=7');

    expect(res.body.days_old).toBe(7);
  });

  it('returns 0 for merges_to_delete when countOlderThan returns 0', async () => {
    mockMerges.countOlderThan.mockResolvedValue(0);
    mockMerges.countAll.mockResolvedValue(3);

    const res = await httpReq(buildApp(), 'GET', '/stats');

    expect(res.body.merges_to_delete).toBe(0);
  });

  it('handles null counts gracefully (returns 0)', async () => {
    mockMerges.countOlderThan.mockResolvedValue(null);
    mockMerges.countAll.mockResolvedValue(null);

    const res = await httpReq(buildApp(), 'GET', '/stats');

    expect(res.body.merges_to_delete).toBe(0);
    expect(res.body.total_merges).toBe(0);
  });

  it('returns 500 when countOlderThan throws', async () => {
    mockMerges.countOlderThan.mockRejectedValue(new Error('DB error'));

    const res = await httpReq(buildApp(), 'GET', '/stats');

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Failed to get cleanup stats' });
  });

  it('returns 500 when countAll throws', async () => {
    mockMerges.countOlderThan.mockResolvedValue(0);
    mockMerges.countAll.mockRejectedValue(new Error('timeout'));

    const res = await httpReq(buildApp(), 'GET', '/stats');

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Failed to get cleanup stats' });
  });
});
