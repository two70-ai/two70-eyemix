'use strict';

// ---------------------------------------------------------------------------
// Mock supabaseAdmin before any require of the adapter
// ---------------------------------------------------------------------------

// We build a chainable query builder mock so we can set return values per test.
let _mockReturnValue = { data: null, error: null };

function makeMockQuery() {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => Promise.resolve(_mockReturnValue)),
    // When the chain ends without .single(), it should resolve too
    then: undefined,
  };

  // Allow the chain to resolve as a promise (for array queries / delete / insert without .single())
  const proxy = new Proxy(chain, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return jest.fn().mockReturnThis();
    },
  });

  // Make the chain itself thenable so `await query` works (for calls that don't call .single())
  proxy.then = (resolve) => resolve(_mockReturnValue);

  return proxy;
}

const mockQuery = makeMockQuery();

jest.mock('../../services/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => mockQuery),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mock is registered)
// ---------------------------------------------------------------------------
const { supabaseAdmin } = require('../../services/supabase');
const adapter = require('../supabaseAdapter');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setReturn(data, error = null) {
  _mockReturnValue = { data, error, count: typeof data === 'number' ? data : undefined };
}

function setCount(count, error = null) {
  _mockReturnValue = { data: null, count, error };
}

beforeEach(() => {
  jest.clearAllMocks();
  setReturn(null, null);
});

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
describe('users', () => {
  describe('findById', () => {
    it('returns user when found', async () => {
      const user = { id: '1', email: 'a@b.com', role: 'admin', created_at: 'now' };
      setReturn(user);
      const result = await adapter.users.findById('1');
      expect(result).toEqual(user);
      expect(supabaseAdmin.from).toHaveBeenCalledWith('users');
    });

    it('returns null when not found (PGRST116)', async () => {
      setReturn(null, { code: 'PGRST116', message: 'no rows' });
      const result = await adapter.users.findById('missing');
      expect(result).toBeNull();
    });

    it('throws on unexpected error', async () => {
      setReturn(null, { code: 'OTHER', message: 'db down' });
      await expect(adapter.users.findById('1')).rejects.toThrow('db down');
    });
  });

  describe('findByEmail', () => {
    it('returns user with password_hash included', async () => {
      const user = { id: '1', email: 'a@b.com', password_hash: 'hash', role: 'client', created_at: 'now' };
      setReturn(user);
      const result = await adapter.users.findByEmail('a@b.com');
      expect(result).toEqual(user);
      expect(result.password_hash).toBe('hash');
    });

    it('returns null when not found', async () => {
      setReturn(null, { code: 'PGRST116', message: 'no rows' });
      expect(await adapter.users.findByEmail('x@y.com')).toBeNull();
    });
  });

  describe('findByIdAndRole', () => {
    it('returns user when role matches', async () => {
      setReturn({ id: '1', role: 'client' });
      const result = await adapter.users.findByIdAndRole('1', 'client');
      expect(result).toEqual({ id: '1', role: 'client' });
    });

    it('returns null when role does not match (PGRST116)', async () => {
      setReturn(null, { code: 'PGRST116', message: 'no rows' });
      expect(await adapter.users.findByIdAndRole('1', 'admin')).toBeNull();
    });
  });

  describe('create', () => {
    it('returns new user on success', async () => {
      const newUser = { id: '99', email: 'new@b.com', role: 'client', created_at: 'now' };
      setReturn(newUser);
      const result = await adapter.users.create({ email: 'new@b.com', password_hash: 'h', role: 'client' });
      expect(result).toEqual(newUser);
    });

    it('throws when supabase returns an error', async () => {
      setReturn(null, { message: 'unique violation' });
      await expect(
        adapter.users.create({ email: 'dup@b.com', password_hash: 'h', role: 'client' })
      ).rejects.toThrow('unique violation');
    });
  });

  describe('count', () => {
    it('returns numeric count', async () => {
      setCount(5);
      const result = await adapter.users.count();
      expect(result).toBe(5);
    });

    it('throws on error', async () => {
      setCount(null, { message: 'count error' });
      await expect(adapter.users.count()).rejects.toThrow('count error');
    });
  });
});

// ---------------------------------------------------------------------------
// couples
// ---------------------------------------------------------------------------
describe('couples', () => {
  describe('findAll', () => {
    it('returns array of couples', async () => {
      const rows = [{ id: 'c1' }, { id: 'c2' }];
      setReturn(rows);
      const result = await adapter.couples.findAll();
      expect(result).toEqual(rows);
    });

    it('returns [] when data is null', async () => {
      setReturn(null);
      const result = await adapter.couples.findAll();
      expect(result).toEqual([]);
    });
  });

  describe('findAllByIds', () => {
    it('returns filtered couples', async () => {
      const rows = [{ id: 'c1' }];
      setReturn(rows);
      const result = await adapter.couples.findAllByIds(['c1']);
      expect(result).toEqual(rows);
    });
  });

  describe('findById', () => {
    it('returns couple or null', async () => {
      setReturn({ id: 'c1', person_a_name: 'A' });
      expect(await adapter.couples.findById('c1')).toMatchObject({ id: 'c1' });

      setReturn(null, { code: 'PGRST116', message: 'not found' });
      expect(await adapter.couples.findById('missing')).toBeNull();
    });
  });

  describe('findByIdSimple', () => {
    it('returns slim couple shape', async () => {
      setReturn({ id: 'c1', person_a_name: 'A', person_b_name: 'B' });
      const result = await adapter.couples.findByIdSimple('c1');
      expect(result).toEqual({ id: 'c1', person_a_name: 'A', person_b_name: 'B' });
    });
  });

  describe('create', () => {
    it('returns created couple', async () => {
      const couple = { id: 'c1', person_a_name: 'A', person_b_name: 'B', created_by: 'u1' };
      setReturn(couple);
      const result = await adapter.couples.create({ person_a_name: 'A', person_b_name: 'B', created_by: 'u1' });
      expect(result).toEqual(couple);
    });

    it('throws on error', async () => {
      setReturn(null, { message: 'insert error' });
      await expect(
        adapter.couples.create({ person_a_name: 'A', person_b_name: 'B', created_by: 'u1' })
      ).rejects.toThrow('insert error');
    });
  });

  describe('delete', () => {
    it('resolves without error on success', async () => {
      setReturn(null, null);
      await expect(adapter.couples.delete('c1')).resolves.toBeUndefined();
    });

    it('throws on error', async () => {
      setReturn(null, { message: 'delete failed' });
      await expect(adapter.couples.delete('c1')).rejects.toThrow('delete failed');
    });
  });
});

// ---------------------------------------------------------------------------
// promptTemplates
// ---------------------------------------------------------------------------
describe('promptTemplates', () => {
  describe('findAll', () => {
    it('returns all templates by default', async () => {
      const rows = [{ id: 't1', is_active: false }, { id: 't2', is_active: true }];
      setReturn(rows);
      const result = await adapter.promptTemplates.findAll();
      expect(result).toEqual(rows);
    });

    it('filters active only when activeOnly=true', async () => {
      const rows = [{ id: 't2', is_active: true }];
      setReturn(rows);
      const result = await adapter.promptTemplates.findAll({ activeOnly: true });
      expect(result).toEqual(rows);
    });

    it('returns [] when no rows', async () => {
      setReturn(null);
      expect(await adapter.promptTemplates.findAll()).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns template or null', async () => {
      setReturn({ id: 't1', name: 'T' });
      expect(await adapter.promptTemplates.findById('t1')).toMatchObject({ id: 't1' });

      setReturn(null, { code: 'PGRST116', message: 'not found' });
      expect(await adapter.promptTemplates.findById('missing')).toBeNull();
    });
  });

  describe('findByIdActive', () => {
    it('returns null for inactive template (PGRST116)', async () => {
      setReturn(null, { code: 'PGRST116', message: 'not found' });
      expect(await adapter.promptTemplates.findByIdActive('t_inactive')).toBeNull();
    });

    it('returns template when active', async () => {
      setReturn({ id: 't1', name: 'T', prompt_text: 'do it' });
      expect(await adapter.promptTemplates.findByIdActive('t1')).toMatchObject({ id: 't1' });
    });
  });

  describe('create', () => {
    it('returns new template', async () => {
      const tpl = { id: 't1', name: 'T', prompt_text: 'p', category: 'c', is_active: true };
      setReturn(tpl);
      const result = await adapter.promptTemplates.create({ name: 'T', description: '', prompt_text: 'p', category: 'c', is_active: true });
      expect(result).toEqual(tpl);
    });

    it('throws on error', async () => {
      setReturn(null, { message: 'create error' });
      await expect(
        adapter.promptTemplates.create({ name: 'T', description: '', prompt_text: 'p', category: 'c', is_active: true })
      ).rejects.toThrow('create error');
    });
  });

  describe('update', () => {
    it('returns updated template', async () => {
      const updated = { id: 't1', name: 'New' };
      setReturn(updated);
      const result = await adapter.promptTemplates.update('t1', { name: 'New' });
      expect(result).toEqual(updated);
    });

    it('returns null when row not found (PGRST116)', async () => {
      setReturn(null, { code: 'PGRST116', message: 'not found' });
      expect(await adapter.promptTemplates.update('missing', { name: 'X' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('resolves without error', async () => {
      setReturn(null, null);
      await expect(adapter.promptTemplates.delete('t1')).resolves.toBeUndefined();
    });

    it('throws on error', async () => {
      setReturn(null, { message: 'delete error' });
      await expect(adapter.promptTemplates.delete('t1')).rejects.toThrow('delete error');
    });
  });
});

// ---------------------------------------------------------------------------
// merges
// ---------------------------------------------------------------------------
describe('merges', () => {
  describe('findAll', () => {
    it('returns array', async () => {
      setReturn([{ id: 'm1' }]);
      expect(await adapter.merges.findAll()).toEqual([{ id: 'm1' }]);
    });

    it('returns [] when null', async () => {
      setReturn(null);
      expect(await adapter.merges.findAll()).toEqual([]);
    });
  });

  describe('findAllByCoupleIds', () => {
    it('returns filtered merges', async () => {
      setReturn([{ id: 'm1', couple_id: 'c1' }]);
      const result = await adapter.merges.findAllByCoupleIds(['c1']);
      expect(result).toEqual([{ id: 'm1', couple_id: 'c1' }]);
    });
  });

  describe('findAllByCoupleIdAndStatus', () => {
    it('returns merges matching couple and status', async () => {
      setReturn([{ id: 'm1', status: 'completed' }]);
      const result = await adapter.merges.findAllByCoupleIdAndStatus('c1', 'completed');
      expect(result).toEqual([{ id: 'm1', status: 'completed' }]);
    });
  });

  describe('findById', () => {
    it('returns merge or null', async () => {
      setReturn({ id: 'm1' });
      expect(await adapter.merges.findById('m1')).toMatchObject({ id: 'm1' });

      setReturn(null, { code: 'PGRST116', message: 'not found' });
      expect(await adapter.merges.findById('missing')).toBeNull();
    });
  });

  describe('create', () => {
    it('returns created merge', async () => {
      const merge = { id: 'm1', status: 'pending' };
      setReturn(merge);
      const result = await adapter.merges.create({
        id: 'm1', couple_id: 'c1', template_id: 't1',
        iris_a_url: 'a', iris_b_url: 'b', prompt_used: 'p',
        status: 'pending', created_by: 'u1',
      });
      expect(result).toEqual(merge);
    });

    it('throws on error', async () => {
      setReturn(null, { message: 'merge create error' });
      await expect(
        adapter.merges.create({ id: 'm1', couple_id: 'c1', template_id: 't1', iris_a_url: 'a', iris_b_url: 'b', prompt_used: 'p', status: 'pending', created_by: 'u1' })
      ).rejects.toThrow('merge create error');
    });
  });

  describe('update', () => {
    it('resolves without error on success', async () => {
      setReturn(null, null);
      await expect(adapter.merges.update('m1', { status: 'failed' })).resolves.toBeUndefined();
    });

    it('throws on error', async () => {
      setReturn(null, { message: 'update error' });
      await expect(adapter.merges.update('m1', { status: 'failed' })).rejects.toThrow('update error');
    });
  });

  describe('updateWithJoins', () => {
    it('returns merge with join data', async () => {
      const merge = { id: 'm1', status: 'completed', couples: { id: 'c1' }, prompt_templates: { id: 't1' } };
      setReturn(merge);
      const result = await adapter.merges.updateWithJoins('m1', { status: 'completed', result_image_url: 'url' });
      expect(result).toEqual(merge);
    });

    it('returns null when not found', async () => {
      setReturn(null, { code: 'PGRST116', message: 'not found' });
      expect(await adapter.merges.updateWithJoins('missing', {})).toBeNull();
    });
  });

  describe('delete', () => {
    it('resolves on success', async () => {
      setReturn(null, null);
      await expect(adapter.merges.delete('m1')).resolves.toBeUndefined();
    });

    it('throws on error', async () => {
      setReturn(null, { message: 'delete error' });
      await expect(adapter.merges.delete('m1')).rejects.toThrow('delete error');
    });
  });

  describe('deleteByIds', () => {
    it('resolves on success', async () => {
      setReturn(null, null);
      await expect(adapter.merges.deleteByIds(['m1', 'm2'])).resolves.toBeUndefined();
    });

    it('throws on error', async () => {
      setReturn(null, { message: 'bulk delete error' });
      await expect(adapter.merges.deleteByIds(['m1'])).rejects.toThrow('bulk delete error');
    });
  });

  describe('findOlderThan', () => {
    it('returns old merge rows', async () => {
      const rows = [{ id: 'm1', status: 'completed' }];
      setReturn(rows);
      const result = await adapter.merges.findOlderThan('2025-01-01', ['completed', 'failed']);
      expect(result).toEqual(rows);
    });

    it('returns [] when none found', async () => {
      setReturn(null);
      expect(await adapter.merges.findOlderThan('2099-01-01', ['completed'])).toEqual([]);
    });
  });

  describe('countAll', () => {
    it('returns numeric total count', async () => {
      setCount(42);
      expect(await adapter.merges.countAll()).toBe(42);
    });

    it('throws on error', async () => {
      setCount(null, { message: 'count error' });
      await expect(adapter.merges.countAll()).rejects.toThrow('count error');
    });
  });

  describe('countOlderThan', () => {
    it('returns count of old merges', async () => {
      setCount(7);
      expect(await adapter.merges.countOlderThan('2025-01-01')).toBe(7);
    });

    it('throws on error', async () => {
      setCount(null, { message: 'count error' });
      await expect(adapter.merges.countOlderThan('2025-01-01')).rejects.toThrow('count error');
    });
  });
});

// ---------------------------------------------------------------------------
// clientAccess
// ---------------------------------------------------------------------------
describe('clientAccess', () => {
  describe('findByClientAndCouple', () => {
    it('returns access record', async () => {
      const record = { couple_id: 'c1', paywall_unlocked: true, unlocked_at: 'now' };
      setReturn(record);
      expect(await adapter.clientAccess.findByClientAndCouple('u1', 'c1')).toEqual(record);
    });

    it('returns null when not found', async () => {
      setReturn(null, { code: 'PGRST116', message: 'not found' });
      expect(await adapter.clientAccess.findByClientAndCouple('u1', 'c_missing')).toBeNull();
    });
  });

  describe('findAllByClient', () => {
    it('returns all access records for a client', async () => {
      const rows = [{ couple_id: 'c1', couples: { id: 'c1' } }];
      setReturn(rows);
      expect(await adapter.clientAccess.findAllByClient('u1')).toEqual(rows);
    });

    it('returns [] when none', async () => {
      setReturn(null);
      expect(await adapter.clientAccess.findAllByClient('u1')).toEqual([]);
    });
  });

  describe('findCoupleIdsByClient', () => {
    it('extracts couple_id from rows', async () => {
      setReturn([{ couple_id: 'c1' }, { couple_id: 'c2' }]);
      const result = await adapter.clientAccess.findCoupleIdsByClient('u1');
      expect(result).toEqual(['c1', 'c2']);
    });

    it('returns [] when no access rows', async () => {
      setReturn(null);
      expect(await adapter.clientAccess.findCoupleIdsByClient('u1')).toEqual([]);
    });
  });

  describe('findUnlockedCoupleIdsByClient', () => {
    it('returns only unlocked couple ids', async () => {
      setReturn([
        { couple_id: 'c1', paywall_unlocked: true },
        { couple_id: 'c2', paywall_unlocked: false },
        { couple_id: 'c3', paywall_unlocked: true },
      ]);
      const result = await adapter.clientAccess.findUnlockedCoupleIdsByClient('u1');
      expect(result).toEqual(['c1', 'c3']);
    });

    it('returns [] when nothing unlocked', async () => {
      setReturn([{ couple_id: 'c1', paywall_unlocked: false }]);
      expect(await adapter.clientAccess.findUnlockedCoupleIdsByClient('u1')).toEqual([]);
    });

    it('returns [] when no rows at all', async () => {
      setReturn(null);
      expect(await adapter.clientAccess.findUnlockedCoupleIdsByClient('u1')).toEqual([]);
    });
  });

  describe('create', () => {
    it('resolves without error on success', async () => {
      setReturn(null, null);
      await expect(
        adapter.clientAccess.create({ client_user_id: 'u1', couple_id: 'c1', paywall_unlocked: false })
      ).resolves.toBeUndefined();
    });

    it('throws on error', async () => {
      setReturn(null, { message: 'insert error' });
      await expect(
        adapter.clientAccess.create({ client_user_id: 'u1', couple_id: 'c1', paywall_unlocked: false })
      ).rejects.toThrow('insert error');
    });
  });

  describe('upsert', () => {
    it('returns upserted access record', async () => {
      const record = { client_user_id: 'u1', couple_id: 'c1', paywall_unlocked: true, unlocked_at: 'now' };
      setReturn(record);
      const result = await adapter.clientAccess.upsert({
        client_user_id: 'u1', couple_id: 'c1', paywall_unlocked: true, unlocked_at: 'now',
      });
      expect(result).toEqual(record);
    });

    it('throws on error', async () => {
      setReturn(null, { message: 'upsert error' });
      await expect(
        adapter.clientAccess.upsert({ client_user_id: 'u1', couple_id: 'c1', paywall_unlocked: true, unlocked_at: 'now' })
      ).rejects.toThrow('upsert error');
    });
  });
});

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------
describe('initialize', () => {
  it('is a no-op that resolves', async () => {
    await expect(adapter.initialize()).resolves.toBeUndefined();
  });
});
