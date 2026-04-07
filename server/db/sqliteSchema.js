'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

/**
 * Opens (or creates) the SQLite database at dbPath, applies PRAGMAs, and
 * creates all tables + indexes if they don't exist.
 *
 * @param {string} dbPath - Absolute or relative path to the .sqlite file
 * @returns {import('better-sqlite3').Database}
 */
function initializeDatabase(dbPath) {
  // Ensure the parent directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // WAL mode is much faster for concurrent reads; foreign keys are off by
  // default in SQLite so we must enable them explicitly.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'client'
                      CHECK (role IN ('admin', 'client')),
      display_name  TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS couples (
      id               TEXT PRIMARY KEY,
      person_a_name    TEXT NOT NULL,
      person_b_name    TEXT NOT NULL,
      person_a_iris_url TEXT,
      person_b_iris_url TEXT,
      created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prompt_templates (
      id                 TEXT PRIMARY KEY,
      name               TEXT NOT NULL,
      description        TEXT,
      prompt_text        TEXT NOT NULL,
      category           TEXT DEFAULT 'general',
      reference_image_url TEXT,
      is_active          INTEGER NOT NULL DEFAULT 1,
      created_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS merges (
      id               TEXT PRIMARY KEY,
      couple_id        TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
      template_id      TEXT REFERENCES prompt_templates(id) ON DELETE SET NULL,
      iris_a_url       TEXT,
      iris_b_url       TEXT,
      result_image_url TEXT,
      prompt_used      TEXT,
      status           TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS client_access (
      id              TEXT PRIMARY KEY,
      client_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      couple_id       TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
      paywall_unlocked INTEGER NOT NULL DEFAULT 0,
      unlocked_at     TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (client_user_id, couple_id)
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_users_email              ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role               ON users(role);
    CREATE INDEX IF NOT EXISTS idx_couples_created_by       ON couples(created_by);
    CREATE INDEX IF NOT EXISTS idx_couples_created_at       ON couples(created_at);
    CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
    CREATE INDEX IF NOT EXISTS idx_merges_couple_id         ON merges(couple_id);
    CREATE INDEX IF NOT EXISTS idx_merges_status            ON merges(status);
    CREATE INDEX IF NOT EXISTS idx_merges_created_at        ON merges(created_at);
    CREATE INDEX IF NOT EXISTS idx_client_access_user       ON client_access(client_user_id);
    CREATE INDEX IF NOT EXISTS idx_client_access_couple     ON client_access(couple_id);
  `);

  return db;
}

module.exports = { initializeDatabase };
