const VALID_SOURCES = ['supabase', 'sqlite'];

const DB_SOURCE = (process.env.DB_SOURCE || 'supabase').toLowerCase();

if (!VALID_SOURCES.includes(DB_SOURCE)) {
  throw new Error(
    `Invalid DB_SOURCE "${DB_SOURCE}". Must be one of: ${VALID_SOURCES.join(', ')}`
  );
}

// Lazy-require so that adapters with heavy setup (e.g. SQLite) are only loaded
// when actually configured.
const adapter = require(`./${DB_SOURCE}Adapter`);

module.exports = {
  users: adapter.users,
  couples: adapter.couples,
  promptTemplates: adapter.promptTemplates,
  merges: adapter.merges,
  clientAccess: adapter.clientAccess,
  initialize: adapter.initialize,
};
