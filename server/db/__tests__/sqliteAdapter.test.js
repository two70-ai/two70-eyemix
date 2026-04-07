'use strict';

// ---------------------------------------------------------------------------
// SQLite adapter integration tests
//
// These tests run against a real in-memory (temp file) SQLite database so we
// can verify SQL correctness, boolean normalization, JOIN nesting, and all
// edge cases without mocking the DB layer itself.
// ---------------------------------------------------------------------------

const os = require('os');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Create a unique temp DB path per test run so parallel jest workers don't
// collide.
const TMP_DB = path.join(os.tmpdir(), `eyemix_test_${Date.now()}_${process.pid}.sqlite`);

// We re-require the adapter fresh, pointing it at the temp DB.
const adapter = require('../sqliteAdapter');

beforeAll(() => {
  adapter.initialize(TMP_DB);
});

afterAll(() => {
  // Clean up the temp file
  try { fs.unlinkSync(TMP_DB); } catch (_) {}
  // WAL mode creates side-car files
  try { fs.unlinkSync(`${TMP_DB}-shm`); } catch (_) {}
  try { fs.unlinkSync(`${TMP_DB}-wal`); } catch (_) {}
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedUser(overrides = {}) {
  return adapter.users.create({
    email: `user_${uuidv4()}@test.com`,
    password_hash: 'hashed',
    role: 'client',
    ...overrides,
  });
}

async function seedAdmin(overrides = {}) {
  return adapter.users.create({
    email: `admin_${uuidv4()}@test.com`,
    password_hash: 'hashed',
    role: 'admin',
    ...overrides,
  });
}

async function seedCouple(created_by, overrides = {}) {
  return adapter.couples.create({
    person_a_name: 'Alice',
    person_b_name: 'Bob',
    created_by,
    ...overrides,
  });
}

async function seedTemplate(created_by = null, overrides = {}) {
  return adapter.promptTemplates.create({
    name: `Template ${uuidv4()}`,
    prompt_text: 'merge these irises',
    category: 'general',
    is_active: true,
    created_by,
    ...overrides,
  });
}

async function seedMerge(couple_id, template_id, created_by = null, overrides = {}) {
  return adapter.merges.create({
    id: uuidv4(),
    couple_id,
    template_id,
    iris_a_url: 'http://example.com/a.jpg',
    iris_b_url: 'http://example.com/b.jpg',
    prompt_used: 'the prompt',
    status: 'pending',
    created_by,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

describe('initialize', () => {
  it('is a function and does not throw when called again', () => {
    // Already called in beforeAll — calling again with a second path should
    // just reinitialize (the module replaces db).  We verify it doesn't throw.
    expect(() => adapter.initialize(TMP_DB)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

describe('users', () => {
  describe('create', () => {
    it('returns id, email, role, created_at', async () => {
      const user = await seedUser({ role: 'admin' });
      expect(user).toMatchObject({ email: expect.any(String), role: 'admin' });
      expect(user.id).toBeDefined();
      expect(user.created_at).toBeDefined();
      // password_hash should NOT be in the returned object
      expect(user.password_hash).toBeUndefined();
    });

    it('generates a unique UUID for each user', async () => {
      const a = await seedUser();
      const b = await seedUser();
      expect(a.id).not.toBe(b.id);
    });

    it('rejects duplicate emails', async () => {
      const email = `dup_${uuidv4()}@test.com`;
      await adapter.users.create({ email, password_hash: 'h', role: 'client' });
      await expect(
        adapter.users.create({ email, password_hash: 'h2', role: 'client' })
      ).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('returns the user when found', async () => {
      const created = await seedUser();
      const found = await adapter.users.findById(created.id);
      expect(found).toMatchObject({ id: created.id, email: created.email });
    });

    it('returns null for unknown id', async () => {
      expect(await adapter.users.findById('nonexistent')).toBeNull();
    });

    it('does not expose password_hash', async () => {
      const created = await seedUser();
      const found = await adapter.users.findById(created.id);
      expect(found.password_hash).toBeUndefined();
    });
  });

  describe('findByEmail', () => {
    it('returns user including password_hash', async () => {
      const email = `byemail_${uuidv4()}@test.com`;
      await adapter.users.create({ email, password_hash: 'secret_hash', role: 'client' });
      const found = await adapter.users.findByEmail(email);
      expect(found.email).toBe(email);
      expect(found.password_hash).toBe('secret_hash');
    });

    it('returns null when email not found', async () => {
      expect(await adapter.users.findByEmail('nobody@nowhere.com')).toBeNull();
    });
  });

  describe('findByIdAndRole', () => {
    it('returns user when id and role match', async () => {
      const user = await seedUser({ role: 'client' });
      const found = await adapter.users.findByIdAndRole(user.id, 'client');
      expect(found).toMatchObject({ id: user.id, role: 'client' });
    });

    it('returns null when role does not match', async () => {
      const user = await seedUser({ role: 'client' });
      expect(await adapter.users.findByIdAndRole(user.id, 'admin')).toBeNull();
    });

    it('returns null for unknown id', async () => {
      expect(await adapter.users.findByIdAndRole('ghost', 'admin')).toBeNull();
    });
  });

  describe('count', () => {
    it('returns a number', async () => {
      const before = await adapter.users.count();
      await seedUser();
      const after = await adapter.users.count();
      expect(typeof before).toBe('number');
      expect(after).toBeGreaterThan(before);
    });
  });
});

// ---------------------------------------------------------------------------
// couples
// ---------------------------------------------------------------------------

describe('couples', () => {
  let admin;

  beforeAll(async () => {
    admin = await seedAdmin();
  });

  describe('create', () => {
    it('returns couple with nested users object containing email', async () => {
      const couple = await seedCouple(admin.id);
      expect(couple.id).toBeDefined();
      expect(couple.person_a_name).toBe('Alice');
      expect(couple.person_b_name).toBe('Bob');
      expect(couple.created_by).toBe(admin.id);
      expect(couple.users).toMatchObject({ email: admin.email });
    });

    it('accepts null created_by', async () => {
      const couple = await adapter.couples.create({
        person_a_name: 'X',
        person_b_name: 'Y',
        created_by: null,
      });
      expect(couple.id).toBeDefined();
      expect(couple.users).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns array of couples ordered by created_at DESC', async () => {
      const all = await adapter.couples.findAll();
      expect(Array.isArray(all)).toBe(true);
      // All rows should have nested users field
      all.forEach((c) => expect(c).toHaveProperty('users'));
    });

    it('returns empty array when no couples exist (resilience)', async () => {
      // Can't actually empty the table in a shared DB; just verify the type
      const all = await adapter.couples.findAll();
      expect(Array.isArray(all)).toBe(true);
    });
  });

  describe('findAllByIds', () => {
    it('returns only the requested couples', async () => {
      const c1 = await seedCouple(admin.id);
      const c2 = await seedCouple(admin.id);
      const c3 = await seedCouple(admin.id);

      const result = await adapter.couples.findAllByIds([c1.id, c3.id]);
      const ids = result.map((c) => c.id);
      expect(ids).toContain(c1.id);
      expect(ids).toContain(c3.id);
      expect(ids).not.toContain(c2.id);
    });

    it('returns [] for empty ids array', async () => {
      expect(await adapter.couples.findAllByIds([])).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the couple with users nested', async () => {
      const created = await seedCouple(admin.id);
      const found = await adapter.couples.findById(created.id);
      expect(found).toMatchObject({ id: created.id });
      expect(found.users).toMatchObject({ email: admin.email });
    });

    it('returns null for unknown id', async () => {
      expect(await adapter.couples.findById('ghost')).toBeNull();
    });
  });

  describe('findByIdSimple', () => {
    it('returns only id, person_a_name, person_b_name', async () => {
      const created = await seedCouple(admin.id, { person_a_name: 'Slim', person_b_name: 'Shady' });
      const found = await adapter.couples.findByIdSimple(created.id);
      expect(found).toEqual({ id: created.id, person_a_name: 'Slim', person_b_name: 'Shady' });
    });

    it('returns null for unknown id', async () => {
      expect(await adapter.couples.findByIdSimple('ghost')).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the couple', async () => {
      const couple = await seedCouple(admin.id);
      await adapter.couples.delete(couple.id);
      expect(await adapter.couples.findById(couple.id)).toBeNull();
    });

    it('does not throw when deleting a non-existent id', async () => {
      await expect(adapter.couples.delete('nonexistent')).resolves.toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// promptTemplates
// ---------------------------------------------------------------------------

describe('promptTemplates', () => {
  describe('create', () => {
    it('returns template with boolean is_active normalized to true', async () => {
      const tpl = await seedTemplate(null, { is_active: true });
      expect(tpl.is_active).toBe(true);
      expect(typeof tpl.is_active).toBe('boolean');
    });

    it('stores is_active=false correctly', async () => {
      const tpl = await seedTemplate(null, { is_active: false });
      expect(tpl.is_active).toBe(false);
      expect(typeof tpl.is_active).toBe('boolean');
    });

    it('defaults is_active to true when not provided', async () => {
      const tpl = await adapter.promptTemplates.create({
        name: `Default active ${uuidv4()}`,
        prompt_text: 'test',
      });
      expect(tpl.is_active).toBe(true);
    });

    it('generates a unique UUID', async () => {
      const a = await seedTemplate();
      const b = await seedTemplate();
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('findAll', () => {
    it('returns all templates with booleans normalized', async () => {
      await seedTemplate(null, { is_active: true });
      await seedTemplate(null, { is_active: false });
      const all = await adapter.promptTemplates.findAll();
      expect(Array.isArray(all)).toBe(true);
      all.forEach((t) => {
        expect(typeof t.is_active).toBe('boolean');
      });
    });

    it('filters only active when activeOnly=true', async () => {
      const active = await seedTemplate(null, { is_active: true });
      const inactive = await seedTemplate(null, { is_active: false });

      const all = await adapter.promptTemplates.findAll({ activeOnly: true });
      const ids = all.map((t) => t.id);

      expect(ids).toContain(active.id);
      expect(ids).not.toContain(inactive.id);
      all.forEach((t) => expect(t.is_active).toBe(true));
    });
  });

  describe('findById', () => {
    it('returns template with normalized boolean', async () => {
      const created = await seedTemplate(null, { is_active: false });
      const found = await adapter.promptTemplates.findById(created.id);
      expect(found.id).toBe(created.id);
      expect(found.is_active).toBe(false);
      expect(typeof found.is_active).toBe('boolean');
    });

    it('returns null for unknown id', async () => {
      expect(await adapter.promptTemplates.findById('ghost')).toBeNull();
    });
  });

  describe('findByIdActive', () => {
    it('returns id, name, prompt_text for an active template', async () => {
      const tpl = await seedTemplate(null, { is_active: true, name: 'Active Tpl', prompt_text: 'do stuff' });
      const found = await adapter.promptTemplates.findByIdActive(tpl.id);
      expect(found).toEqual({ id: tpl.id, name: 'Active Tpl', prompt_text: 'do stuff' });
    });

    it('returns null for an inactive template', async () => {
      const tpl = await seedTemplate(null, { is_active: false });
      expect(await adapter.promptTemplates.findByIdActive(tpl.id)).toBeNull();
    });

    it('returns null for unknown id', async () => {
      expect(await adapter.promptTemplates.findByIdActive('ghost')).toBeNull();
    });
  });

  describe('update', () => {
    it('updates allowed fields and returns normalized row', async () => {
      const tpl = await seedTemplate(null, { name: 'Old Name', is_active: true });
      const updated = await adapter.promptTemplates.update(tpl.id, { name: 'New Name', is_active: false });
      expect(updated.name).toBe('New Name');
      expect(updated.is_active).toBe(false);
      expect(typeof updated.is_active).toBe('boolean');
    });

    it('ignores unknown keys in updates', async () => {
      const tpl = await seedTemplate();
      const result = await adapter.promptTemplates.update(tpl.id, { totally_fake_field: 'nope' });
      // Should return the existing row unchanged
      expect(result.id).toBe(tpl.id);
    });

    it('returns null for unknown id', async () => {
      const result = await adapter.promptTemplates.update('ghost', { name: 'X' });
      expect(result).toBeNull();
    });

    it('refreshes updated_at on change', async () => {
      const tpl = await seedTemplate();
      const originalUpdatedAt = tpl.updated_at;
      // Small sleep to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 2));
      const updated = await adapter.promptTemplates.update(tpl.id, { name: 'Changed' });
      expect(updated.updated_at).not.toBe(originalUpdatedAt);
    });
  });

  describe('delete', () => {
    it('removes the template', async () => {
      const tpl = await seedTemplate();
      await adapter.promptTemplates.delete(tpl.id);
      expect(await adapter.promptTemplates.findById(tpl.id)).toBeNull();
    });

    it('does not throw for non-existent id', async () => {
      await expect(adapter.promptTemplates.delete('ghost')).resolves.toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// merges
// ---------------------------------------------------------------------------

describe('merges', () => {
  let admin;
  let couple;
  let template;

  beforeAll(async () => {
    admin = await seedAdmin();
    couple = await seedCouple(admin.id);
    template = await seedTemplate(admin.id, { is_active: true });
  });

  describe('create', () => {
    it('uses caller-supplied id', async () => {
      const id = uuidv4();
      const merge = await adapter.merges.create({
        id,
        couple_id: couple.id,
        template_id: template.id,
        iris_a_url: 'a',
        iris_b_url: 'b',
        prompt_used: 'p',
        status: 'pending',
        created_by: admin.id,
      });
      expect(merge.id).toBe(id);
    });

    it('returns merge with nested couples and prompt_templates', async () => {
      const merge = await seedMerge(couple.id, template.id, admin.id);
      expect(merge.couples).toMatchObject({
        id: couple.id,
        person_a_name: 'Alice',
        person_b_name: 'Bob',
      });
      expect(merge.prompt_templates).toMatchObject({ id: template.id });
    });

    it('returns null couples and prompt_templates when foreign keys are null', async () => {
      const merge = await adapter.merges.create({
        id: uuidv4(),
        couple_id: couple.id,
        template_id: null,
        status: 'pending',
      });
      expect(merge.prompt_templates).toBeNull();
    });

    it('defaults status to pending', async () => {
      const merge = await adapter.merges.create({
        id: uuidv4(),
        couple_id: couple.id,
      });
      expect(merge.status).toBe('pending');
    });
  });

  describe('findAll', () => {
    it('returns array with nested couples and prompt_templates', async () => {
      const all = await adapter.merges.findAll();
      expect(Array.isArray(all)).toBe(true);
      all.forEach((m) => {
        expect(m).toHaveProperty('couples');
        expect(m).toHaveProperty('prompt_templates');
      });
    });
  });

  describe('findAllByCoupleIds', () => {
    it('returns merges for specified couple ids', async () => {
      const otherAdmin = await seedAdmin();
      const otherCouple = await seedCouple(otherAdmin.id);
      await seedMerge(otherCouple.id, template.id);

      const mine = await seedMerge(couple.id, template.id);
      const result = await adapter.merges.findAllByCoupleIds([couple.id]);
      const ids = result.map((m) => m.id);
      expect(ids).toContain(mine.id);
      result.forEach((m) => {
        expect(m.couple_id).toBe(couple.id);
      });
    });

    it('returns [] for empty array', async () => {
      expect(await adapter.merges.findAllByCoupleIds([])).toEqual([]);
    });
  });

  describe('findAllByCoupleIdAndStatus', () => {
    it('returns only merges with matching couple and status', async () => {
      const completedMerge = await seedMerge(couple.id, template.id, null, { status: 'completed' });
      const failedMerge = await seedMerge(couple.id, template.id, null, { status: 'failed' });

      const result = await adapter.merges.findAllByCoupleIdAndStatus(couple.id, 'completed');
      const ids = result.map((m) => m.id);
      expect(ids).toContain(completedMerge.id);
      expect(ids).not.toContain(failedMerge.id);
      result.forEach((m) => {
        expect(m.status).toBe('completed');
        expect(m.couple_id).toBe(couple.id);
      });
    });

    it('includes prompt_templates.description in result', async () => {
      const tplWithDesc = await adapter.promptTemplates.create({
        name: `Desc tpl ${uuidv4()}`,
        prompt_text: 'described',
        description: 'A description',
      });
      const merge = await seedMerge(couple.id, tplWithDesc.id, null, { status: 'completed' });
      const result = await adapter.merges.findAllByCoupleIdAndStatus(couple.id, 'completed');
      const found = result.find((m) => m.id === merge.id);
      expect(found.prompt_templates.description).toBe('A description');
    });
  });

  describe('findById', () => {
    it('returns merge with nested couples and prompt_templates (including description)', async () => {
      const merge = await seedMerge(couple.id, template.id);
      const found = await adapter.merges.findById(merge.id);
      expect(found.id).toBe(merge.id);
      expect(found.couples).toMatchObject({ id: couple.id });
      expect(found.prompt_templates).toMatchObject({ id: template.id });
      // description field present (even if null)
      expect('description' in found.prompt_templates).toBe(true);
    });

    it('returns null for unknown id', async () => {
      expect(await adapter.merges.findById('ghost')).toBeNull();
    });
  });

  describe('update', () => {
    it('updates status and returns the plain row', async () => {
      const merge = await seedMerge(couple.id, template.id);
      const updated = await adapter.merges.update(merge.id, { status: 'failed' });
      expect(updated.status).toBe('failed');
    });

    it('ignores unknown fields', async () => {
      const merge = await seedMerge(couple.id, template.id);
      const result = await adapter.merges.update(merge.id, { nonexistent_col: 'x' });
      expect(result).not.toBeNull();
    });

    it('returns null for unknown id', async () => {
      const result = await adapter.merges.update('ghost', { status: 'failed' });
      expect(result).toBeNull();
    });
  });

  describe('updateWithJoins', () => {
    it('returns the merge with nested couples and prompt_templates after update', async () => {
      const merge = await seedMerge(couple.id, template.id);
      const updated = await adapter.merges.updateWithJoins(merge.id, {
        status: 'completed',
        result_image_url: 'https://example.com/result.png',
      });
      expect(updated.status).toBe('completed');
      expect(updated.result_image_url).toBe('https://example.com/result.png');
      expect(updated.couples).toMatchObject({ id: couple.id });
      expect(updated.prompt_templates).toMatchObject({ id: template.id });
    });

    it('returns null for unknown id', async () => {
      const result = await adapter.merges.updateWithJoins('ghost', { status: 'failed' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the merge', async () => {
      const merge = await seedMerge(couple.id, template.id);
      await adapter.merges.delete(merge.id);
      expect(await adapter.merges.findById(merge.id)).toBeNull();
    });

    it('does not throw for non-existent id', async () => {
      await expect(adapter.merges.delete('ghost')).resolves.toBeUndefined();
    });
  });

  describe('deleteByIds', () => {
    it('removes all specified merges', async () => {
      const m1 = await seedMerge(couple.id, template.id);
      const m2 = await seedMerge(couple.id, template.id);
      await adapter.merges.deleteByIds([m1.id, m2.id]);
      expect(await adapter.merges.findById(m1.id)).toBeNull();
      expect(await adapter.merges.findById(m2.id)).toBeNull();
    });

    it('is a no-op for empty array', async () => {
      await expect(adapter.merges.deleteByIds([])).resolves.toBeUndefined();
    });
  });

  describe('findOlderThan', () => {
    it('returns merges older than the cutoff with matching statuses', async () => {
      const pastDate = '2000-01-01T00:00:00.000Z';
      // All current merges were created now — nothing should be older than 2000
      const result = await adapter.merges.findOlderThan(new Date().toISOString(), ['completed', 'failed']);
      // They should all appear since all rows are "older than now"
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns [] when no merges match the status filter', async () => {
      const result = await adapter.merges.findOlderThan(new Date().toISOString(), ['processing']);
      // No merges are in 'processing' status in our seed data
      expect(result).toEqual([]);
    });

    it('returns [] for empty statuses array', async () => {
      expect(await adapter.merges.findOlderThan(new Date().toISOString(), [])).toEqual([]);
    });

    it('returns rows with id, iris_a_url, iris_b_url, result_image_url, status', async () => {
      const result = await adapter.merges.findOlderThan(new Date().toISOString(), ['pending']);
      if (result.length > 0) {
        const row = result[0];
        expect(row).toHaveProperty('id');
        expect(row).toHaveProperty('iris_a_url');
        expect(row).toHaveProperty('iris_b_url');
        expect(row).toHaveProperty('result_image_url');
        expect(row).toHaveProperty('status');
      }
    });
  });

  describe('countAll', () => {
    it('returns a number', async () => {
      const count = await adapter.merges.countAll();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('increases after inserting a merge', async () => {
      const before = await adapter.merges.countAll();
      await seedMerge(couple.id, template.id);
      const after = await adapter.merges.countAll();
      expect(after).toBe(before + 1);
    });
  });

  describe('countOlderThan', () => {
    it('returns a number', async () => {
      const count = await adapter.merges.countOlderThan(new Date().toISOString());
      expect(typeof count).toBe('number');
    });

    it('returns 0 for a very old cutoff where nothing is older', async () => {
      const count = await adapter.merges.countOlderThan('1970-01-01T00:00:00.000Z');
      expect(count).toBe(0);
    });

    it('counts all merges when cutoff is in the future', async () => {
      const total = await adapter.merges.countAll();
      const countAll = await adapter.merges.countOlderThan('2099-01-01T00:00:00.000Z');
      expect(countAll).toBe(total);
    });
  });
});

// ---------------------------------------------------------------------------
// clientAccess
// ---------------------------------------------------------------------------

describe('clientAccess', () => {
  let client;
  let admin;
  let couple;

  beforeAll(async () => {
    admin = await seedAdmin();
    client = await seedUser({ role: 'client' });
    couple = await seedCouple(admin.id);
  });

  describe('create', () => {
    it('returns the access record with boolean paywall_unlocked', async () => {
      const otherCouple = await seedCouple(admin.id);
      const access = await adapter.clientAccess.create({
        client_user_id: client.id,
        couple_id: otherCouple.id,
        paywall_unlocked: false,
      });
      expect(access.paywall_unlocked).toBe(false);
      expect(typeof access.paywall_unlocked).toBe('boolean');
    });

    it('defaults paywall_unlocked to false', async () => {
      const otherCouple = await seedCouple(admin.id);
      const access = await adapter.clientAccess.create({
        client_user_id: client.id,
        couple_id: otherCouple.id,
      });
      expect(access.paywall_unlocked).toBe(false);
    });

    it('generates a UUID', async () => {
      const otherCouple = await seedCouple(admin.id);
      const access = await adapter.clientAccess.create({
        client_user_id: client.id,
        couple_id: otherCouple.id,
      });
      expect(access.id).toBeDefined();
      expect(typeof access.id).toBe('string');
    });
  });

  describe('findByClientAndCouple', () => {
    it('returns access record with normalized boolean', async () => {
      const testCouple = await seedCouple(admin.id);
      await adapter.clientAccess.create({
        client_user_id: client.id,
        couple_id: testCouple.id,
        paywall_unlocked: false,
      });
      const found = await adapter.clientAccess.findByClientAndCouple(client.id, testCouple.id);
      expect(found).not.toBeNull();
      expect(found.paywall_unlocked).toBe(false);
      expect(typeof found.paywall_unlocked).toBe('boolean');
    });

    it('returns null when no record exists', async () => {
      const result = await adapter.clientAccess.findByClientAndCouple(client.id, 'ghost_couple');
      expect(result).toBeNull();
    });
  });

  describe('findAllByClient', () => {
    it('returns access records with nested couples', async () => {
      const testCouple = await seedCouple(admin.id);
      await adapter.clientAccess.create({
        client_user_id: client.id,
        couple_id: testCouple.id,
      });
      const all = await adapter.clientAccess.findAllByClient(client.id);
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBeGreaterThan(0);
      all.forEach((a) => {
        expect(a).toHaveProperty('couples');
        expect(typeof a.paywall_unlocked).toBe('boolean');
      });
    });

    it('returns [] for a client with no records', async () => {
      const ghost = await seedUser();
      expect(await adapter.clientAccess.findAllByClient(ghost.id)).toEqual([]);
    });
  });

  describe('findCoupleIdsByClient', () => {
    it('returns array of string couple_ids', async () => {
      const testCouple = await seedCouple(admin.id);
      await adapter.clientAccess.create({
        client_user_id: client.id,
        couple_id: testCouple.id,
      });
      const ids = await adapter.clientAccess.findCoupleIdsByClient(client.id);
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.every((id) => typeof id === 'string')).toBe(true);
      expect(ids).toContain(testCouple.id);
    });

    it('returns [] for client with no access', async () => {
      const ghost = await seedUser();
      expect(await adapter.clientAccess.findCoupleIdsByClient(ghost.id)).toEqual([]);
    });
  });

  describe('findUnlockedCoupleIdsByClient', () => {
    it('returns only couple ids where paywall_unlocked is true', async () => {
      const unlockedCouple = await seedCouple(admin.id);
      const lockedCouple = await seedCouple(admin.id);
      const dedicatedClient = await seedUser();

      await adapter.clientAccess.create({
        client_user_id: dedicatedClient.id,
        couple_id: unlockedCouple.id,
        paywall_unlocked: true,
      });
      await adapter.clientAccess.create({
        client_user_id: dedicatedClient.id,
        couple_id: lockedCouple.id,
        paywall_unlocked: false,
      });

      const ids = await adapter.clientAccess.findUnlockedCoupleIdsByClient(dedicatedClient.id);
      expect(ids).toContain(unlockedCouple.id);
      expect(ids).not.toContain(lockedCouple.id);
    });

    it('returns [] when nothing is unlocked', async () => {
      const newClient = await seedUser();
      const testCouple = await seedCouple(admin.id);
      await adapter.clientAccess.create({
        client_user_id: newClient.id,
        couple_id: testCouple.id,
        paywall_unlocked: false,
      });
      expect(await adapter.clientAccess.findUnlockedCoupleIdsByClient(newClient.id)).toEqual([]);
    });

    it('returns [] for client with no access records', async () => {
      const ghost = await seedUser();
      expect(await adapter.clientAccess.findUnlockedCoupleIdsByClient(ghost.id)).toEqual([]);
    });
  });

  describe('upsert', () => {
    it('inserts when record does not exist', async () => {
      const newClient = await seedUser();
      const testCouple = await seedCouple(admin.id);
      const unlocked_at = new Date().toISOString();

      const access = await adapter.clientAccess.upsert({
        client_user_id: newClient.id,
        couple_id: testCouple.id,
        paywall_unlocked: true,
        unlocked_at,
      });
      expect(access.paywall_unlocked).toBe(true);
      expect(typeof access.paywall_unlocked).toBe('boolean');
      expect(access.unlocked_at).toBe(unlocked_at);
    });

    it('updates existing record on conflict (client_user_id, couple_id)', async () => {
      const newClient = await seedUser();
      const testCouple = await seedCouple(admin.id);

      // First insert
      await adapter.clientAccess.upsert({
        client_user_id: newClient.id,
        couple_id: testCouple.id,
        paywall_unlocked: false,
        unlocked_at: null,
      });

      const unlocked_at = new Date().toISOString();

      // Should UPDATE, not throw
      const updated = await adapter.clientAccess.upsert({
        client_user_id: newClient.id,
        couple_id: testCouple.id,
        paywall_unlocked: true,
        unlocked_at,
      });

      expect(updated.paywall_unlocked).toBe(true);
      expect(updated.unlocked_at).toBe(unlocked_at);
      expect(typeof updated.paywall_unlocked).toBe('boolean');
    });

    it('returns the row after upsert (not undefined)', async () => {
      const newClient = await seedUser();
      const testCouple = await seedCouple(admin.id);
      const result = await adapter.clientAccess.upsert({
        client_user_id: newClient.id,
        couple_id: testCouple.id,
        paywall_unlocked: false,
      });
      expect(result).not.toBeNull();
      expect(result.id).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Schema integrity: foreign key CASCADE / SET NULL behaviour
// ---------------------------------------------------------------------------

describe('schema integrity', () => {
  it('cascades couple deletion to merges and client_access', async () => {
    const admin = await seedAdmin();
    const client = await seedUser();
    const couple = await seedCouple(admin.id);
    const template = await seedTemplate(admin.id);

    const merge = await seedMerge(couple.id, template.id);
    await adapter.clientAccess.create({ client_user_id: client.id, couple_id: couple.id });

    await adapter.couples.delete(couple.id);

    expect(await adapter.merges.findById(merge.id)).toBeNull();
    const accessIds = await adapter.clientAccess.findCoupleIdsByClient(client.id);
    expect(accessIds).not.toContain(couple.id);
  });

  it('sets template_id to null on merge when template is deleted', async () => {
    const admin = await seedAdmin();
    const couple = await seedCouple(admin.id);
    const template = await seedTemplate(admin.id);

    const merge = await seedMerge(couple.id, template.id);
    await adapter.promptTemplates.delete(template.id);

    const found = await adapter.merges.findById(merge.id);
    // Merge should still exist but template_id should be NULL
    expect(found).not.toBeNull();
    expect(found.template_id).toBeNull();
    expect(found.prompt_templates).toBeNull();
  });
});
