const { supabaseAdmin } = require('../services/supabase');

// Helper: unwrap a .single() result — returns null when not found, throws on unexpected errors
function unwrapSingle({ data, error }) {
  // PGRST116 = "no rows returned" — not-found, not an error for lookups
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Supabase query error: ${error.message}`);
  }
  return data || null;
}

// Helper: unwrap an array result — returns [] when no data
function unwrapMany({ data, error }) {
  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }
  return data || [];
}

// Helper: throw on any write error
function assertNoError(error, context) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
const users = {
  async findById(id) {
    const result = await supabaseAdmin
      .from('users')
      .select('id, email, role, created_at')
      .eq('id', id)
      .single();
    return unwrapSingle(result);
  },

  // Includes password_hash — only used by auth login
  async findByEmail(email) {
    const result = await supabaseAdmin
      .from('users')
      .select('id, email, password_hash, role, created_at')
      .eq('email', email)
      .single();
    return unwrapSingle(result);
  },

  async findByIdAndRole(id, role) {
    const result = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', id)
      .eq('role', role)
      .single();
    return unwrapSingle(result);
  },

  async create({ email, password_hash, role }) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({ email, password_hash, role })
      .select('id, email, role, created_at')
      .single();
    assertNoError(error, 'users.create failed');
    return data;
  },

  async count() {
    const { count, error } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });
    assertNoError(error, 'users.count failed');
    return count;
  },
};

// ---------------------------------------------------------------------------
// couples
// ---------------------------------------------------------------------------
const couples = {
  async findAll() {
    const result = await supabaseAdmin
      .from('couples')
      .select('*, users!couples_created_by_fkey(email)')
      .order('created_at', { ascending: false });
    return unwrapMany(result);
  },

  async findAllByIds(ids) {
    const result = await supabaseAdmin
      .from('couples')
      .select('*, users!couples_created_by_fkey(email)')
      .order('created_at', { ascending: false })
      .in('id', ids);
    return unwrapMany(result);
  },

  async findById(id) {
    const result = await supabaseAdmin
      .from('couples')
      .select('*, users!couples_created_by_fkey(email)')
      .eq('id', id)
      .single();
    return unwrapSingle(result);
  },

  async findByIdSimple(id) {
    const result = await supabaseAdmin
      .from('couples')
      .select('id, person_a_name, person_b_name')
      .eq('id', id)
      .single();
    return unwrapSingle(result);
  },

  async create({ person_a_name, person_b_name, created_by }) {
    const { data, error } = await supabaseAdmin
      .from('couples')
      .insert({ person_a_name, person_b_name, created_by })
      .select()
      .single();
    assertNoError(error, 'couples.create failed');
    return data;
  },

  async delete(id) {
    const { error } = await supabaseAdmin
      .from('couples')
      .delete()
      .eq('id', id);
    assertNoError(error, `couples.delete failed for id=${id}`);
  },
};

// ---------------------------------------------------------------------------
// promptTemplates
// ---------------------------------------------------------------------------
const promptTemplates = {
  async findAll({ activeOnly = false } = {}) {
    let query = supabaseAdmin
      .from('prompt_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    return unwrapMany(await query);
  },

  async findById(id) {
    const result = await supabaseAdmin
      .from('prompt_templates')
      .select('*')
      .eq('id', id)
      .single();
    return unwrapSingle(result);
  },

  async findByIdActive(id) {
    const result = await supabaseAdmin
      .from('prompt_templates')
      .select('id, name, prompt_text')
      .eq('id', id)
      .eq('is_active', true)
      .single();
    return unwrapSingle(result);
  },

  async create({ name, description, prompt_text, category, is_active }) {
    const { data, error } = await supabaseAdmin
      .from('prompt_templates')
      .insert({ name, description, prompt_text, category, is_active })
      .select()
      .single();
    assertNoError(error, 'promptTemplates.create failed');
    return data;
  },

  async update(id, updates) {
    const result = await supabaseAdmin
      .from('prompt_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    // null means the row wasn't found — callers should treat null as 404
    return unwrapSingle(result);
  },

  async delete(id) {
    const { error } = await supabaseAdmin
      .from('prompt_templates')
      .delete()
      .eq('id', id);
    assertNoError(error, `promptTemplates.delete failed for id=${id}`);
  },
};

// ---------------------------------------------------------------------------
// merges
// ---------------------------------------------------------------------------
const merges = {
  async findAll() {
    const result = await supabaseAdmin
      .from('merges')
      .select('*, couples(id, person_a_name, person_b_name), prompt_templates(id, name, category)')
      .order('created_at', { ascending: false });
    return unwrapMany(result);
  },

  async findAllByCoupleIds(coupleIds) {
    const result = await supabaseAdmin
      .from('merges')
      .select('*, couples(id, person_a_name, person_b_name), prompt_templates(id, name, category)')
      .order('created_at', { ascending: false })
      .in('couple_id', coupleIds);
    return unwrapMany(result);
  },

  async findAllByCoupleIdAndStatus(coupleId, status) {
    const result = await supabaseAdmin
      .from('merges')
      .select('*, prompt_templates(id, name, category, description)')
      .eq('couple_id', coupleId)
      .eq('status', status)
      .order('created_at', { ascending: false });
    return unwrapMany(result);
  },

  async findById(id) {
    const result = await supabaseAdmin
      .from('merges')
      .select('*, couples(id, person_a_name, person_b_name), prompt_templates(id, name, category, description)')
      .eq('id', id)
      .single();
    return unwrapSingle(result);
  },

  async create({ id, couple_id, template_id, iris_a_url, iris_b_url, prompt_used, status, created_by }) {
    const { data, error } = await supabaseAdmin
      .from('merges')
      .insert({ id, couple_id, template_id, iris_a_url, iris_b_url, prompt_used, status, created_by })
      .select()
      .single();
    assertNoError(error, 'merges.create failed');
    return data;
  },

  // Lightweight update — no joins returned (e.g. status-only updates)
  async update(id, updates) {
    const { error } = await supabaseAdmin
      .from('merges')
      .update(updates)
      .eq('id', id);
    assertNoError(error, `merges.update failed for id=${id}`);
  },

  // Full update that returns the row with joins (e.g. final result write)
  async updateWithJoins(id, updates) {
    const result = await supabaseAdmin
      .from('merges')
      .update(updates)
      .eq('id', id)
      .select('*, couples(id, person_a_name, person_b_name), prompt_templates(id, name, category)')
      .single();
    return unwrapSingle(result);
  },

  async delete(id) {
    const { error } = await supabaseAdmin
      .from('merges')
      .delete()
      .eq('id', id);
    assertNoError(error, `merges.delete failed for id=${id}`);
  },

  async deleteByIds(ids) {
    const { error } = await supabaseAdmin
      .from('merges')
      .delete()
      .in('id', ids);
    assertNoError(error, 'merges.deleteByIds failed');
  },

  async findOlderThan(isoDateString, statuses) {
    const result = await supabaseAdmin
      .from('merges')
      .select('id, iris_a_url, iris_b_url, result_image_url, status')
      .lt('created_at', isoDateString)
      .in('status', statuses);
    return unwrapMany(result);
  },

  async countAll() {
    const { count, error } = await supabaseAdmin
      .from('merges')
      .select('*', { count: 'exact', head: true });
    assertNoError(error, 'merges.countAll failed');
    return count;
  },

  async countOlderThan(isoDateString) {
    const { count, error } = await supabaseAdmin
      .from('merges')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', isoDateString);
    assertNoError(error, 'merges.countOlderThan failed');
    return count;
  },
};

// ---------------------------------------------------------------------------
// clientAccess
// ---------------------------------------------------------------------------
const clientAccess = {
  async findByClientAndCouple(clientUserId, coupleId) {
    const result = await supabaseAdmin
      .from('client_access')
      .select('couple_id, paywall_unlocked, unlocked_at')
      .eq('client_user_id', clientUserId)
      .eq('couple_id', coupleId)
      .single();
    return unwrapSingle(result);
  },

  async findAllByClient(clientUserId) {
    const result = await supabaseAdmin
      .from('client_access')
      .select('*, couples(id, person_a_name, person_b_name, created_at)')
      .eq('client_user_id', clientUserId)
      .order('created_at', { ascending: false });
    return unwrapMany(result);
  },

  async findCoupleIdsByClient(clientUserId) {
    const result = await supabaseAdmin
      .from('client_access')
      .select('couple_id')
      .eq('client_user_id', clientUserId);
    const rows = unwrapMany(result);
    return rows.map((r) => r.couple_id);
  },

  async findUnlockedCoupleIdsByClient(clientUserId) {
    const result = await supabaseAdmin
      .from('client_access')
      .select('couple_id, paywall_unlocked')
      .eq('client_user_id', clientUserId);
    const rows = unwrapMany(result);
    return rows.filter((r) => r.paywall_unlocked === true).map((r) => r.couple_id);
  },

  async create({ client_user_id, couple_id, paywall_unlocked }) {
    const { error } = await supabaseAdmin
      .from('client_access')
      .insert({ client_user_id, couple_id, paywall_unlocked });
    assertNoError(error, 'clientAccess.create failed');
  },

  async upsert({ client_user_id, couple_id, paywall_unlocked, unlocked_at }) {
    const { data, error } = await supabaseAdmin
      .from('client_access')
      .upsert({ client_user_id, couple_id, paywall_unlocked, unlocked_at }, { onConflict: 'client_user_id,couple_id' })
      .select()
      .single();
    assertNoError(error, 'clientAccess.upsert failed');
    return data;
  },
};

// ---------------------------------------------------------------------------
// initialize — no-op for Supabase (tables managed by migrations)
// ---------------------------------------------------------------------------
async function initialize() {
  // Supabase schema is managed externally via migrations; nothing to do here
}

module.exports = { users, couples, promptTemplates, merges, clientAccess, initialize };
