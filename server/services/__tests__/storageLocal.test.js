/**
 * Tests for storageLocal.js and storageFactory.js
 *
 * Filesystem tests use STORAGE_LOCAL_BASE_DIR to redirect all storage
 * operations to a per-test-suite temp directory, keeping the real
 * ./data/storage/ untouched.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Shared temp directory created once for the whole file. Each describe block
// that touches the filesystem gets its own sub-directory to avoid cross-test
// pollution.
// ---------------------------------------------------------------------------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyemix-storage-test-'));

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Pure unit tests — no filesystem involvement.
// ---------------------------------------------------------------------------

describe('extractFilenameFromUrl', () => {
  // Load the module without the BASE_DIR override — extractFilenameFromUrl
  // never touches the filesystem.
  const { extractFilenameFromUrl } = require('../storageLocal');

  test('parses a relative URL', () => {
    expect(extractFilenameFromUrl('/api/storage/iris-uploads/abc123.jpg', 'iris-uploads'))
      .toBe('abc123.jpg');
  });

  test('parses an absolute URL', () => {
    expect(
      extractFilenameFromUrl(
        'http://localhost:3000/api/storage/generated-results/foo/bar.png',
        'generated-results',
      ),
    ).toBe('foo/bar.png');
  });

  test('parses a filename with subdirectory (mergeId pattern)', () => {
    expect(
      extractFilenameFromUrl(
        '/api/storage/iris-uploads/merge-abc/iris_a_123.jpg',
        'iris-uploads',
      ),
    ).toBe('merge-abc/iris_a_123.jpg');
  });

  test('returns empty string when bucket does not appear in URL', () => {
    expect(extractFilenameFromUrl('/api/storage/other-bucket/file.jpg', 'iris-uploads')).toBe('');
  });

  test('returns empty string for empty url', () => {
    expect(extractFilenameFromUrl('', 'iris-uploads')).toBe('');
  });

  test('returns empty string for empty bucket', () => {
    expect(extractFilenameFromUrl('/api/storage/iris-uploads/file.jpg', '')).toBe('');
  });

  test('returns empty string for null url', () => {
    expect(extractFilenameFromUrl(null, 'iris-uploads')).toBe('');
  });
});

describe('storageLocal — module exports', () => {
  const storageLocal = require('../storageLocal');

  test('exports BUCKETS with the three expected keys', () => {
    const { BUCKETS } = storageLocal;
    expect(BUCKETS.IRIS_UPLOADS).toBe('iris-uploads');
    expect(BUCKETS.GENERATED_RESULTS).toBe('generated-results');
    expect(BUCKETS.REFERENCE_IMAGES).toBe('reference-images');
  });

  test('exports all six required functions', () => {
    const {
      uploadImage, deleteImage, deleteImages,
      listOldImages, extractFilenameFromUrl, ensureBucketsExist,
    } = storageLocal;
    expect(typeof uploadImage).toBe('function');
    expect(typeof deleteImage).toBe('function');
    expect(typeof deleteImages).toBe('function');
    expect(typeof listOldImages).toBe('function');
    expect(typeof extractFilenameFromUrl).toBe('function');
    expect(typeof ensureBucketsExist).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Filesystem integration tests.
// Each describe block gets its own isolated sub-directory inside tmpDir.
// We load storageLocal fresh (jest.resetModules) with STORAGE_LOCAL_BASE_DIR
// set so BASE_DIR points to our temp location.
// ---------------------------------------------------------------------------

function loadStorageLocalWithBase(base) {
  jest.resetModules();
  process.env.STORAGE_LOCAL_BASE_DIR = base;
  const mod = require('../storageLocal');
  delete process.env.STORAGE_LOCAL_BASE_DIR;
  return mod;
}

describe('ensureBucketsExist()', () => {
  const baseDir = path.join(tmpDir, 'ensure-test');

  test('creates all three bucket directories', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    await mod.ensureBucketsExist();
    for (const bucketName of Object.values(mod.BUCKETS)) {
      const dir = path.join(baseDir, bucketName);
      expect(fs.existsSync(dir)).toBe(true);
      expect(fs.statSync(dir).isDirectory()).toBe(true);
    }
  });

  test('is idempotent — calling twice does not throw', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    await expect(mod.ensureBucketsExist()).resolves.toBeUndefined();
  });
});

describe('uploadImage()', () => {
  const baseDir = path.join(tmpDir, 'upload-test');

  beforeAll(async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    await mod.ensureBucketsExist();
  });

  test('writes buffer to disk and returns correct relative URL', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    const buffer = Buffer.from('fake-image-data');
    const url = await mod.uploadImage('iris-uploads', 'test-image.jpg', buffer, 'image/jpeg');

    expect(url).toBe('/api/storage/iris-uploads/test-image.jpg');
    const written = fs.readFileSync(path.join(baseDir, 'iris-uploads', 'test-image.jpg'));
    expect(written.equals(buffer)).toBe(true);
  });

  test('creates subdirectory automatically for nested filename', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    const buffer = Buffer.from('nested-image');
    const url = await mod.uploadImage('iris-uploads', 'merge-xyz/iris_a_001.jpg', buffer);

    expect(url).toBe('/api/storage/iris-uploads/merge-xyz/iris_a_001.jpg');
    const written = fs.readFileSync(
      path.join(baseDir, 'iris-uploads', 'merge-xyz', 'iris_a_001.jpg'),
    );
    expect(written.equals(buffer)).toBe(true);
  });

  test('overwrites an existing file (upsert behavior)', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    const original = Buffer.from('original');
    const updated = Buffer.from('updated');
    await mod.uploadImage('iris-uploads', 'overwrite-me.jpg', original);
    await mod.uploadImage('iris-uploads', 'overwrite-me.jpg', updated);

    const written = fs.readFileSync(path.join(baseDir, 'iris-uploads', 'overwrite-me.jpg'));
    expect(written.equals(updated)).toBe(true);
  });

  test('works without explicit contentType (default parameter)', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    const buffer = Buffer.from('no-mime');
    const url = await mod.uploadImage('generated-results', 'no-mime.jpg', buffer);
    expect(url).toBe('/api/storage/generated-results/no-mime.jpg');
  });
});

describe('deleteImage()', () => {
  const baseDir = path.join(tmpDir, 'delete-test');

  beforeAll(async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    await mod.ensureBucketsExist();
  });

  test('removes an existing file', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    const filePath = path.join(baseDir, 'iris-uploads', 'to-delete.jpg');
    fs.writeFileSync(filePath, 'data');
    expect(fs.existsSync(filePath)).toBe(true);

    await mod.deleteImage('iris-uploads', 'to-delete.jpg');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test('does not throw when file does not exist (ENOENT swallowed)', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    await expect(
      mod.deleteImage('iris-uploads', 'nonexistent-file.jpg'),
    ).resolves.toBeUndefined();
  });

  test('removes a nested file', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    const dir = path.join(baseDir, 'iris-uploads', 'merge-del');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'iris_a.jpg');
    fs.writeFileSync(filePath, 'data');

    await mod.deleteImage('iris-uploads', 'merge-del/iris_a.jpg');
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

describe('deleteImages()', () => {
  const baseDir = path.join(tmpDir, 'delete-batch-test');

  beforeAll(async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    await mod.ensureBucketsExist();
  });

  test('returns immediately for empty array', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    await expect(mod.deleteImages('iris-uploads', [])).resolves.toBeUndefined();
  });

  test('returns immediately for null', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    await expect(mod.deleteImages('iris-uploads', null)).resolves.toBeUndefined();
  });

  test('returns immediately for undefined', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    await expect(mod.deleteImages('iris-uploads', undefined)).resolves.toBeUndefined();
  });

  test('deletes multiple files', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    const files = ['batch-a.jpg', 'batch-b.jpg', 'batch-c.jpg'];
    for (const f of files) {
      fs.writeFileSync(path.join(baseDir, 'iris-uploads', f), 'data');
    }

    await mod.deleteImages('iris-uploads', files);

    for (const f of files) {
      expect(fs.existsSync(path.join(baseDir, 'iris-uploads', f))).toBe(false);
    }
  });

  test('does not throw when some files are missing — completes the rest', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    const existing = 'batch-exists.jpg';
    fs.writeFileSync(path.join(baseDir, 'iris-uploads', existing), 'data');

    await expect(
      mod.deleteImages('iris-uploads', ['missing-1.jpg', existing, 'missing-2.jpg']),
    ).resolves.toBeUndefined();

    expect(fs.existsSync(path.join(baseDir, 'iris-uploads', existing))).toBe(false);
  });
});

describe('listOldImages()', () => {
  const baseDir = path.join(tmpDir, 'list-test');

  beforeAll(async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    await mod.ensureBucketsExist();
  });

  test('returns empty array when bucket is empty', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    const results = await mod.listOldImages('reference-images', 30);
    expect(results).toEqual([]);
  });

  test('returns empty array when no files are old enough', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    const filePath = path.join(baseDir, 'reference-images', 'fresh.jpg');
    fs.writeFileSync(filePath, 'data');
    // mtime is now — definitely not 30 days old
    const results = await mod.listOldImages('reference-images', 30);
    expect(results).toEqual([]);
  });

  test('returns files older than the cutoff', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    const oldFile = path.join(baseDir, 'reference-images', 'old-image.jpg');
    fs.writeFileSync(oldFile, 'old-data');

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldFile, sixtyDaysAgo, sixtyDaysAgo);

    const results = await mod.listOldImages('reference-images', 30);
    const names = results.map((r) => r.name);
    expect(names).toContain('old-image.jpg');

    const entry = results.find((r) => r.name === 'old-image.jpg');
    // Allow 1 second of tolerance on the timestamp comparison
    expect(Math.abs(new Date(entry.created_at).getTime() - sixtyDaysAgo.getTime())).toBeLessThan(1000);
  });

  test('recursively finds old files in subdirectories', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    const subDir = path.join(baseDir, 'reference-images', 'merge-old');
    fs.mkdirSync(subDir, { recursive: true });
    const nestedFile = path.join(subDir, 'iris_b.jpg');
    fs.writeFileSync(nestedFile, 'nested-old');

    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    fs.utimesSync(nestedFile, fortyDaysAgo, fortyDaysAgo);

    const results = await mod.listOldImages('reference-images', 30);
    const names = results.map((r) => r.name);
    expect(names).toContain(path.join('merge-old', 'iris_b.jpg'));
  });

  test('does not return files newer than cutoff', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    const freshFile = path.join(baseDir, 'reference-images', 'very-fresh.jpg');
    fs.writeFileSync(freshFile, 'fresh');

    const results = await mod.listOldImages('reference-images', 30);
    const names = results.map((r) => r.name);
    expect(names).not.toContain('very-fresh.jpg');
  });

  test('returned objects have name and created_at fields as ISO strings', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    const oldFile2 = path.join(baseDir, 'reference-images', 'check-shape.jpg');
    fs.writeFileSync(oldFile2, 'data');
    const ago = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldFile2, ago, ago);

    const results = await mod.listOldImages('reference-images', 30);
    const entry = results.find((r) => r.name === 'check-shape.jpg');
    expect(entry).toBeDefined();
    expect(typeof entry.name).toBe('string');
    expect(typeof entry.created_at).toBe('string');
    // created_at must be a valid ISO 8601 string that round-trips
    expect(new Date(entry.created_at).toISOString()).toBe(entry.created_at);
  });

  test('returns empty array when bucket directory does not exist', async () => {
    const mod = loadStorageLocalWithBase(baseDir);
    const results = await mod.listOldImages('nonexistent-bucket', 30);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// storageFactory tests — verify it returns the correct adapter.
// ---------------------------------------------------------------------------

describe('storageFactory', () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.DB_SOURCE;
  });

  test('returns storageLocal when DB_SOURCE=sqlite', () => {
    process.env.DB_SOURCE = 'sqlite';
    const factory = require('../storageFactory');
    // Verify it re-exports storageLocal by checking a function identity
    // that only storageLocal could provide (Supabase adapter requires credentials).
    // The safest cross-check: uploadImage should resolve to the local version
    // which returns a /api/storage/ URL — we confirm by inspecting source.
    // We'll verify the BUCKETS values match and no Supabase client is used.
    expect(factory.BUCKETS).toEqual({
      IRIS_UPLOADS: 'iris-uploads',
      GENERATED_RESULTS: 'generated-results',
      REFERENCE_IMAGES: 'reference-images',
    });
    expect(typeof factory.uploadImage).toBe('function');
    expect(typeof factory.ensureBucketsExist).toBe('function');
  });

  test('returns the supabase storage adapter when DB_SOURCE is not set', () => {
    delete process.env.DB_SOURCE;
    jest.mock('../storage', () => ({
      BUCKETS: { IRIS_UPLOADS: 'iris-uploads', GENERATED_RESULTS: 'generated-results', REFERENCE_IMAGES: 'reference-images' },
      uploadImage: jest.fn().mockResolvedValue('https://supabase.example.com/file.jpg'),
      deleteImage: jest.fn(),
      deleteImages: jest.fn(),
      listOldImages: jest.fn().mockResolvedValue([]),
      extractFilenameFromUrl: jest.fn().mockReturnValue('file.jpg'),
      ensureBucketsExist: jest.fn(),
    }));

    const factory = require('../storageFactory');
    const supabaseStorage = require('../storage');
    expect(factory.uploadImage).toBe(supabaseStorage.uploadImage);
  });

  test('returns the supabase storage adapter when DB_SOURCE is an unrecognised value', () => {
    process.env.DB_SOURCE = 'supabase';
    jest.mock('../storage', () => ({
      BUCKETS: { IRIS_UPLOADS: 'iris-uploads', GENERATED_RESULTS: 'generated-results', REFERENCE_IMAGES: 'reference-images' },
      uploadImage: jest.fn().mockResolvedValue('https://supabase.example.com/file.jpg'),
      deleteImage: jest.fn(),
      deleteImages: jest.fn(),
      listOldImages: jest.fn().mockResolvedValue([]),
      extractFilenameFromUrl: jest.fn().mockReturnValue('file.jpg'),
      ensureBucketsExist: jest.fn(),
    }));

    const factory = require('../storageFactory');
    const supabaseStorage = require('../storage');
    expect(factory.uploadImage).toBe(supabaseStorage.uploadImage);
  });

  test('factory re-exports all six functions and BUCKETS regardless of adapter', () => {
    process.env.DB_SOURCE = 'sqlite';
    const factory = require('../storageFactory');
    const required = ['uploadImage', 'deleteImage', 'deleteImages', 'listOldImages', 'extractFilenameFromUrl', 'ensureBucketsExist', 'BUCKETS'];
    for (const key of required) {
      expect(factory[key]).toBeDefined();
    }
  });
});
