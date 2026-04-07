'use strict';

// We mock both adapters so the factory tests never touch real dependencies
jest.mock('../supabaseAdapter', () => ({
  users: { findById: jest.fn() },
  couples: { findAll: jest.fn() },
  promptTemplates: { findAll: jest.fn() },
  merges: { findAll: jest.fn() },
  clientAccess: { findAllByClient: jest.fn() },
  initialize: jest.fn(),
}));

jest.mock('../sqliteAdapter', () => ({
  users: { findById: jest.fn() },
  couples: { findAll: jest.fn() },
  promptTemplates: { findAll: jest.fn() },
  merges: { findAll: jest.fn() },
  clientAccess: { findAllByClient: jest.fn() },
  initialize: jest.fn(),
}), { virtual: true });

// Each test isolates module state via jest.resetModules()
afterEach(() => {
  jest.resetModules();
});

describe('db/index factory', () => {
  it('loads the supabase adapter when DB_SOURCE=supabase', () => {
    process.env.DB_SOURCE = 'supabase';
    const db = require('../index');
    expect(db).toHaveProperty('users');
    expect(db).toHaveProperty('couples');
    expect(db).toHaveProperty('promptTemplates');
    expect(db).toHaveProperty('merges');
    expect(db).toHaveProperty('clientAccess');
    expect(db).toHaveProperty('initialize');
    expect(typeof db.initialize).toBe('function');
  });

  it('defaults to supabase when DB_SOURCE is not set', () => {
    delete process.env.DB_SOURCE;
    const db = require('../index');
    expect(db).toHaveProperty('users');
  });

  it('is case-insensitive for DB_SOURCE', () => {
    process.env.DB_SOURCE = 'SUPABASE';
    expect(() => require('../index')).not.toThrow();
  });

  it('throws for an unknown DB_SOURCE value', () => {
    process.env.DB_SOURCE = 'postgres';
    expect(() => require('../index')).toThrow(/Invalid DB_SOURCE/);
  });

  it('treats an empty string DB_SOURCE as the default (supabase)', () => {
    process.env.DB_SOURCE = '';
    // Empty string is falsy so the `|| 'supabase'` default applies
    expect(() => require('../index')).not.toThrow();
    const db = require('../index');
    expect(db).toHaveProperty('users');
  });

  it('exports are the adapter objects (not wrappers)', () => {
    process.env.DB_SOURCE = 'supabase';
    // Re-require the mocked adapter to compare references
    jest.resetModules();
    jest.mock('../supabaseAdapter', () => ({
      users: { sentinel: 'users' },
      couples: { sentinel: 'couples' },
      promptTemplates: { sentinel: 'promptTemplates' },
      merges: { sentinel: 'merges' },
      clientAccess: { sentinel: 'clientAccess' },
      initialize: () => {},
    }));
    const db = require('../index');
    expect(db.users).toEqual({ sentinel: 'users' });
    expect(db.couples).toEqual({ sentinel: 'couples' });
    expect(db.merges).toEqual({ sentinel: 'merges' });
  });
});
