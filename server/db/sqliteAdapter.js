'use strict';

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { initializeDatabase } = require('./sqliteSchema');

// ---------------------------------------------------------------------------
// Module-level db handle — set by initialize()
// ---------------------------------------------------------------------------
let db = null;

const DEFAULT_DB_PATH = path.join(__dirname, '../../data/eyemix.sqlite');

/**
 * Opens/creates the SQLite database and prepares the module for use.
 * Must be called before any repository methods.
 *
 * @param {string} [dbPath] - Override the default database path.
 */
function initialize(dbPath) {
  const resolvedPath = dbPath || process.env.SQLITE_DB_PATH || DEFAULT_DB_PATH;
  db = initializeDatabase(resolvedPath);
}

// ---------------------------------------------------------------------------
// Boolean normalization helpers
//
// SQLite stores booleans as INTEGER (0 / 1).  The rest of the application
// expects plain JS booleans, so we normalize on every read and write.
// ---------------------------------------------------------------------------

/** Fields that must be normalized from INTEGER to boolean on read */
const BOOLEAN_FIELDS = new Set(['is_active', 'paywall_unlocked']);

/**
 * Converts all known boolean INTEGER fields in a row object to real JS booleans.
 * Returns a new object; never mutates the input.
 *
 * @param {object|null|undefined} row
 * @returns {object|null}
 */
function normalizeBooleans(row) {
  if (row == null) return null;
  const out = { ...row };
  for (const field of BOOLEAN_FIELDS) {
    if (field in out) {
      out[field] = out[field] === 1 || out[field] === true;
    }
  }
  return out;
}

/**
 * Converts a JS boolean value to SQLite INTEGER (0 / 1).
 * Passes through non-boolean values unchanged.
 *
 * @param {*} value
 * @returns {0|1|*}
 */
function toSqliteBool(value) {
  if (value === true) return 1;
  if (value === false) return 0;
  return value;
}

// ---------------------------------------------------------------------------
// JOIN result nesting helpers
// ---------------------------------------------------------------------------

/**
 * Extracts columns with a given prefix from a flat row, strips the prefix,
 * and returns them as a nested object.  If every extracted value is null
 * (meaning the LEFT JOIN found no match) returns null.
 *
 * @param {object} row     - Flat row from better-sqlite3
 * @param {string} prefix  - e.g. '_c_'
 * @returns {object|null}
 */
function extractPrefixed(row, prefix) {
  const result = {};
  let allNull = true;
  for (const key of Object.keys(row)) {
    if (key.startsWith(prefix)) {
      const shortKey = key.slice(prefix.length);
      result[shortKey] = row[key];
      if (row[key] !== null) allNull = false;
    }
  }
  return allNull ? null : result;
}

/**
 * Removes all keys that start with any of the given prefixes from a row,
 * returning the cleaned copy.
 *
 * @param {object}   row
 * @param {string[]} prefixes
 * @returns {object}
 */
function stripPrefixed(row, prefixes) {
  const out = {};
  for (const key of Object.keys(row)) {
    if (!prefixes.some((p) => key.startsWith(p))) {
      out[key] = row[key];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dynamic IN-clause helpers
// ---------------------------------------------------------------------------

/**
 * Builds a string of '?' placeholders for a SQL IN clause.
 *
 * @param {Array} items
 * @returns {string}  e.g. '?, ?, ?'
 */
function inPlaceholders(items) {
  return Array(items.length).fill('?').join(', ');
}

// ---------------------------------------------------------------------------
// Timestamp helper
// ---------------------------------------------------------------------------

function now() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// users repository
// ---------------------------------------------------------------------------

const users = {
  /**
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const row = db
      .prepare('SELECT id, email, role, created_at FROM users WHERE id = ?')
      .get(id);
    return row ?? null;
  },

  /**
   * Returns the user including password_hash so the auth layer can verify it.
   *
   * @returns {Promise<object|null>}
   */
  async findByEmail(email) {
    const row = db
      .prepare(
        'SELECT id, email, password_hash, role, created_at FROM users WHERE email = ?'
      )
      .get(email);
    return row ?? null;
  },

  /**
   * Used by middleware to confirm a JWT subject still has the expected role.
   *
   * @returns {Promise<object|null>}
   */
  async findByIdAndRole(id, role) {
    const row = db
      .prepare('SELECT id, role FROM users WHERE id = ? AND role = ?')
      .get(id, role);
    return row ?? null;
  },

  /**
   * @param {{ email: string, password_hash: string, role: string }} data
   * @returns {Promise<object>}  The newly created user (id, email, role, created_at)
   */
  async create({ email, password_hash, role }) {
    const id = uuidv4();
    const timestamp = now();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, email, password_hash, role, timestamp, timestamp);
    return { id, email, role, created_at: timestamp };
  },

  /**
   * Returns a raw number to match the Supabase adapter interface.
   *
   * @returns {Promise<number>}
   */
  async count() {
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
    return row.count;
  },
};

// ---------------------------------------------------------------------------
// SQL fragment reused by couples queries
// ---------------------------------------------------------------------------

const COUPLES_SELECT = `
  SELECT c.*,
    u.email AS _u_email
  FROM couples c
  LEFT JOIN users u ON c.created_by = u.id
`;

/**
 * Transforms a flat couples+users JOIN row into the nested shape:
 *   { ...couple, users: { email } | null }
 */
function nestCoupleRow(row) {
  if (row == null) return null;
  const users = extractPrefixed(row, '_u_');
  const base = stripPrefixed(row, ['_u_']);
  return { ...base, users };
}

// ---------------------------------------------------------------------------
// couples repository
// ---------------------------------------------------------------------------

const couples = {
  /**
   * @returns {Promise<object[]>}
   */
  async findAll() {
    const rows = db
      .prepare(`${COUPLES_SELECT} ORDER BY c.created_at DESC`)
      .all();
    return rows.map(nestCoupleRow);
  },

  /**
   * @param {string[]} ids
   * @returns {Promise<object[]>}
   */
  async findAllByIds(ids) {
    if (ids.length === 0) return [];
    const rows = db
      .prepare(
        `${COUPLES_SELECT} WHERE c.id IN (${inPlaceholders(ids)}) ORDER BY c.created_at DESC`
      )
      .all(...ids);
    return rows.map(nestCoupleRow);
  },

  /**
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const row = db
      .prepare(`${COUPLES_SELECT} WHERE c.id = ?`)
      .get(id);
    return nestCoupleRow(row);
  },

  /**
   * Lightweight lookup — no join, only the three fields needed for access
   * checks and merge creation.
   *
   * @returns {Promise<object|null>}
   */
  async findByIdSimple(id) {
    const row = db
      .prepare(
        'SELECT id, person_a_name, person_b_name FROM couples WHERE id = ?'
      )
      .get(id);
    return row ?? null;
  },

  /**
   * @param {{ person_a_name: string, person_b_name: string, created_by: string }} data
   * @returns {Promise<object>}
   */
  async create({ person_a_name, person_b_name, created_by }) {
    const id = uuidv4();
    const timestamp = now();
    db.prepare(
      `INSERT INTO couples
         (id, person_a_name, person_b_name, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, person_a_name, person_b_name, created_by ?? null, timestamp, timestamp);

    // Return the full row with the users join so the shape matches findById
    return this.findById(id);
  },

  /**
   * @returns {Promise<void>}
   */
  async delete(id) {
    db.prepare('DELETE FROM couples WHERE id = ?').run(id);
  },
};

// ---------------------------------------------------------------------------
// promptTemplates repository
// ---------------------------------------------------------------------------

const promptTemplates = {
  /**
   * @param {{ activeOnly?: boolean }} [opts]
   * @returns {Promise<object[]>}
   */
  async findAll({ activeOnly = false } = {}) {
    const sql = activeOnly
      ? 'SELECT * FROM prompt_templates WHERE is_active = 1 ORDER BY created_at DESC'
      : 'SELECT * FROM prompt_templates ORDER BY created_at DESC';
    const rows = db.prepare(sql).all();
    return rows.map(normalizeBooleans);
  },

  /**
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const row = db
      .prepare('SELECT * FROM prompt_templates WHERE id = ?')
      .get(id);
    return normalizeBooleans(row ?? null);
  },

  /**
   * Lightweight lookup for merge creation — only fetches the fields needed to
   * build the prompt.
   *
   * @returns {Promise<object|null>}
   */
  async findByIdActive(id) {
    const row = db
      .prepare(
        'SELECT id, name, prompt_text FROM prompt_templates WHERE id = ? AND is_active = 1'
      )
      .get(id);
    return row ?? null;
  },

  /**
   * @param {{ name: string, description?: string, prompt_text: string, category?: string, is_active?: boolean, created_by?: string }} data
   * @returns {Promise<object>}
   */
  async create({ name, description = null, prompt_text, category = 'general', is_active = true, created_by = null }) {
    const id = uuidv4();
    const timestamp = now();
    db.prepare(
      `INSERT INTO prompt_templates
         (id, name, description, prompt_text, category, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, name, description, prompt_text, category,
      toSqliteBool(is_active), created_by, timestamp, timestamp
    );
    return this.findById(id);
  },

  /**
   * Applies only the provided keys as SET clauses; always refreshes updated_at.
   *
   * @param {string}  id
   * @param {object}  updates  - Any subset of template columns
   * @returns {Promise<object|null>}
   */
  async update(id, updates) {
    const ALLOWED = new Set([
      'name', 'description', 'prompt_text', 'category',
      'is_active', 'reference_image_url',
    ]);

    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED.has(key)) continue;
      setClauses.push(`${key} = ?`);
      values.push(BOOLEAN_FIELDS.has(key) ? toSqliteBool(value) : value);
    }

    if (setClauses.length === 0) {
      // Nothing to update — just return the current row
      return this.findById(id);
    }

    setClauses.push('updated_at = ?');
    values.push(now());
    values.push(id);

    db.prepare(
      `UPDATE prompt_templates SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...values);

    return this.findById(id);
  },

  /**
   * @returns {Promise<void>}
   */
  async delete(id) {
    db.prepare('DELETE FROM prompt_templates WHERE id = ?').run(id);
  },
};

// ---------------------------------------------------------------------------
// SQL fragment reused by merges queries (full join with couples + templates)
// ---------------------------------------------------------------------------

const MERGES_SELECT_FULL = `
  SELECT m.*,
    c.id            AS _c_id,
    c.person_a_name AS _c_person_a_name,
    c.person_b_name AS _c_person_b_name,
    t.id            AS _t_id,
    t.name          AS _t_name,
    t.category      AS _t_category
  FROM merges m
  LEFT JOIN couples c ON m.couple_id = c.id
  LEFT JOIN prompt_templates t ON m.template_id = t.id
`;

/**
 * Like MERGES_SELECT_FULL but also pulls t.description — used by the single-
 * merge detail endpoint and the client merges endpoint.
 */
const MERGES_SELECT_WITH_DESC = `
  SELECT m.*,
    c.id            AS _c_id,
    c.person_a_name AS _c_person_a_name,
    c.person_b_name AS _c_person_b_name,
    t.id            AS _t_id,
    t.name          AS _t_name,
    t.category      AS _t_category,
    t.description   AS _t_description
  FROM merges m
  LEFT JOIN couples c ON m.couple_id = c.id
  LEFT JOIN prompt_templates t ON m.template_id = t.id
`;

/**
 * Transforms a flat merges JOIN row (with optional _t_description) into:
 *   { ...merge, couples: { id, person_a_name, person_b_name } | null,
 *               prompt_templates: { id, name, category[, description] } | null }
 */
function nestMergeRow(row) {
  if (row == null) return null;
  const coupleNested = extractPrefixed(row, '_c_');
  const templateNested = extractPrefixed(row, '_t_');
  const base = stripPrefixed(row, ['_c_', '_t_']);
  return {
    ...base,
    couples: coupleNested,
    prompt_templates: templateNested,
  };
}

// ---------------------------------------------------------------------------
// merges repository
// ---------------------------------------------------------------------------

const merges = {
  /**
   * @returns {Promise<object[]>}
   */
  async findAll() {
    const rows = db
      .prepare(`${MERGES_SELECT_FULL} ORDER BY m.created_at DESC`)
      .all();
    return rows.map(nestMergeRow);
  },

  /**
   * @param {string[]} coupleIds
   * @returns {Promise<object[]>}
   */
  async findAllByCoupleIds(coupleIds) {
    if (coupleIds.length === 0) return [];
    const rows = db
      .prepare(
        `${MERGES_SELECT_FULL}
         WHERE m.couple_id IN (${inPlaceholders(coupleIds)})
         ORDER BY m.created_at DESC`
      )
      .all(...coupleIds);
    return rows.map(nestMergeRow);
  },

  /**
   * Used by the client merges endpoint — filters by couple + status and
   * includes template description.
   *
   * @returns {Promise<object[]>}
   */
  async findAllByCoupleIdAndStatus(coupleId, status) {
    const rows = db
      .prepare(
        `${MERGES_SELECT_WITH_DESC}
         WHERE m.couple_id = ? AND m.status = ?
         ORDER BY m.created_at DESC`
      )
      .all(coupleId, status);
    return rows.map(nestMergeRow);
  },

  /**
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const row = db
      .prepare(`${MERGES_SELECT_WITH_DESC} WHERE m.id = ?`)
      .get(id);
    return nestMergeRow(row);
  },

  /**
   * id is caller-supplied (the route already generates it before uploading
   * images so we can include it in the storage path).
   *
   * @param {{ id: string, couple_id: string, template_id?: string, iris_a_url?: string, iris_b_url?: string, prompt_used?: string, status?: string, created_by?: string }} data
   * @returns {Promise<object>}
   */
  async create({ id, couple_id, template_id = null, iris_a_url = null, iris_b_url = null, prompt_used = null, status = 'pending', created_by = null }) {
    const timestamp = now();
    db.prepare(
      `INSERT INTO merges
         (id, couple_id, template_id, iris_a_url, iris_b_url, prompt_used, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, couple_id, template_id, iris_a_url, iris_b_url, prompt_used, status, created_by, timestamp, timestamp);

    return this.findById(id);
  },

  /**
   * Applies a partial update and returns the plain (non-joined) row.
   * Used when the caller doesn't need nested relations (e.g. status-only updates).
   *
   * @param {string} id
   * @param {object} updates
   * @returns {Promise<object|null>}
   */
  async update(id, updates) {
    const ALLOWED = new Set([
      'status', 'result_image_url', 'iris_a_url', 'iris_b_url',
      'prompt_used', 'template_id',
    ]);

    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED.has(key)) continue;
      setClauses.push(`${key} = ?`);
      values.push(value);
    }

    if (setClauses.length === 0) {
      const row = db.prepare('SELECT * FROM merges WHERE id = ?').get(id);
      return row ?? null;
    }

    setClauses.push('updated_at = ?');
    values.push(now());
    values.push(id);

    db.prepare(
      `UPDATE merges SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...values);

    const row = db.prepare('SELECT * FROM merges WHERE id = ?').get(id);
    return row ?? null;
  },

  /**
   * Like update() but returns the full nested shape (couples + prompt_templates).
   * Used by the merge-create route's final response.
   *
   * @returns {Promise<object|null>}
   */
  async updateWithJoins(id, updates) {
    await this.update(id, updates);
    return this.findById(id);
  },

  /**
   * @returns {Promise<void>}
   */
  async delete(id) {
    db.prepare('DELETE FROM merges WHERE id = ?').run(id);
  },

  /**
   * @param {string[]} ids
   * @returns {Promise<void>}
   */
  async deleteByIds(ids) {
    if (ids.length === 0) return;
    db.prepare(
      `DELETE FROM merges WHERE id IN (${inPlaceholders(ids)})`
    ).run(...ids);
  },

  /**
   * Returns merge rows (plain, no joins) where created_at < isoDateString and
   * status is one of the provided statuses.  Used by the cleanup route.
   *
   * @param {string}   isoDateString
   * @param {string[]} statuses
   * @returns {Promise<object[]>}
   */
  async findOlderThan(isoDateString, statuses) {
    if (statuses.length === 0) return [];
    const rows = db
      .prepare(
        `SELECT id, iris_a_url, iris_b_url, result_image_url, status
         FROM merges
         WHERE created_at < ? AND status IN (${inPlaceholders(statuses)})`
      )
      .all(isoDateString, ...statuses);
    return rows;
  },

  /**
   * Returns a raw number to match the Supabase adapter interface.
   *
   * @returns {Promise<number>}
   */
  async countAll() {
    const row = db.prepare('SELECT COUNT(*) as count FROM merges').get();
    return row.count;
  },

  /**
   * @param {string} isoDateString
   * @returns {Promise<number>}
   */
  async countOlderThan(isoDateString) {
    const row = db
      .prepare('SELECT COUNT(*) as count FROM merges WHERE created_at < ?')
      .get(isoDateString);
    return row.count;
  },
};

// ---------------------------------------------------------------------------
// SQL fragment reused by clientAccess queries
// ---------------------------------------------------------------------------

const CLIENT_ACCESS_SELECT_WITH_COUPLES = `
  SELECT ca.*,
    c.id            AS _c_id,
    c.person_a_name AS _c_person_a_name,
    c.person_b_name AS _c_person_b_name,
    c.created_at    AS _c_created_at
  FROM client_access ca
  LEFT JOIN couples c ON ca.couple_id = c.id
`;

/**
 * Transforms a flat client_access+couples JOIN row into:
 *   { ...access, couples: { id, person_a_name, person_b_name, created_at } | null }
 * Also normalizes the paywall_unlocked boolean.
 */
function nestClientAccessRow(row) {
  if (row == null) return null;
  const coupleNested = extractPrefixed(row, '_c_');
  const base = stripPrefixed(row, ['_c_']);
  return normalizeBooleans({ ...base, couples: coupleNested });
}

// ---------------------------------------------------------------------------
// clientAccess repository
// ---------------------------------------------------------------------------

const clientAccess = {
  /**
   * @returns {Promise<object|null>}
   */
  async findByClientAndCouple(clientUserId, coupleId) {
    const row = db
      .prepare(
        `SELECT couple_id, paywall_unlocked, unlocked_at
         FROM client_access
         WHERE client_user_id = ? AND couple_id = ?`
      )
      .get(clientUserId, coupleId);
    return normalizeBooleans(row ?? null);
  },

  /**
   * @returns {Promise<object[]>}
   */
  async findAllByClient(clientUserId) {
    const rows = db
      .prepare(
        `${CLIENT_ACCESS_SELECT_WITH_COUPLES}
         WHERE ca.client_user_id = ?
         ORDER BY ca.created_at DESC`
      )
      .all(clientUserId);
    return rows.map(nestClientAccessRow);
  },

  /**
   * Returns only couple IDs — used for filtering the couples list.
   *
   * @returns {Promise<string[]>}
   */
  async findCoupleIdsByClient(clientUserId) {
    const rows = db
      .prepare(
        'SELECT couple_id FROM client_access WHERE client_user_id = ?'
      )
      .all(clientUserId);
    return rows.map((r) => r.couple_id);
  },

  /**
   * Returns only couple IDs where the paywall has been unlocked.
   *
   * @returns {Promise<string[]>}
   */
  async findUnlockedCoupleIdsByClient(clientUserId) {
    const rows = db
      .prepare(
        'SELECT couple_id FROM client_access WHERE client_user_id = ? AND paywall_unlocked = 1'
      )
      .all(clientUserId);
    return rows.map((r) => r.couple_id);
  },

  /**
   * @param {{ client_user_id: string, couple_id: string, paywall_unlocked?: boolean }} data
   * @returns {Promise<object>}
   */
  async create({ client_user_id, couple_id, paywall_unlocked = false }) {
    const id = uuidv4();
    const timestamp = now();
    db.prepare(
      `INSERT INTO client_access
         (id, client_user_id, couple_id, paywall_unlocked, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, client_user_id, couple_id, toSqliteBool(paywall_unlocked), timestamp, timestamp);

    const row = db
      .prepare('SELECT * FROM client_access WHERE id = ?')
      .get(id);
    return normalizeBooleans(row);
  },

  /**
   * INSERT OR UPDATE using SQLite's ON CONFLICT clause.  The UNIQUE constraint
   * on (client_user_id, couple_id) triggers the DO UPDATE path when the record
   * already exists.
   *
   * @param {{ client_user_id: string, couple_id: string, paywall_unlocked?: boolean, unlocked_at?: string|null }} data
   * @returns {Promise<object>}
   */
  async upsert({ client_user_id, couple_id, paywall_unlocked = false, unlocked_at = null }) {
    const id = uuidv4();
    const timestamp = now();

    db.prepare(
      `INSERT INTO client_access
         (id, client_user_id, couple_id, paywall_unlocked, unlocked_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(client_user_id, couple_id) DO UPDATE SET
         paywall_unlocked = excluded.paywall_unlocked,
         unlocked_at      = excluded.unlocked_at,
         updated_at       = excluded.updated_at`
    ).run(
      id, client_user_id, couple_id,
      toSqliteBool(paywall_unlocked), unlocked_at,
      timestamp, timestamp
    );

    const row = db
      .prepare(
        'SELECT * FROM client_access WHERE client_user_id = ? AND couple_id = ?'
      )
      .get(client_user_id, couple_id);
    return normalizeBooleans(row);
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

module.exports = {
  initialize,
  users,
  couples,
  promptTemplates,
  merges,
  clientAccess,
};
