import { supabase } from './supabaseClient.js';
import { normalizeCycleLogs } from './cycleTracking.js';

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }
  return supabase;
}

async function requireUserId() {
  const client = requireClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) throw error;
  if (!user?.id) throw new Error('Not signed in');
  return { client, userId: user.id };
}

function mapRowToLog(row) {
  if (!row) return null;
  return {
    date: row.log_date,
    bleedingLevel: row.bleeding_level ?? null,
    symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],
    note: typeof row.note === 'string' ? row.note : '',
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

function mapLogToRow(userId, log) {
  return {
    user_id: userId,
    log_date: log.date,
    bleeding_level: log.bleedingLevel ?? null,
    symptoms: Array.isArray(log.symptoms) ? log.symptoms : [],
    note: typeof log.note === 'string' ? log.note : '',
    updated_at: log.updatedAt || new Date().toISOString(),
  };
}

/**
 * Fetch all cycle logs for the signed-in user.
 * @returns {Promise<Array>} normalized logs (empty array when none)
 */
export async function fetchCycleLogs() {
  const { client, userId } = await requireUserId();

  const { data, error } = await client
    .from('cycle_logs')
    .select('log_date, bleeding_level, symptoms, note, created_at, updated_at')
    .eq('user_id', userId)
    .order('log_date', { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  return normalizeCycleLogs(data.map(mapRowToLog));
}

/**
 * Upsert one cycle log for the signed-in user (unique on user_id + log_date).
 * @param {object} log
 */
export async function upsertCycleLogRemote(log) {
  const { client, userId } = await requireUserId();
  const [normalized] = normalizeCycleLogs([log]);
  if (!normalized) throw new Error('Invalid cycle log');

  const payload = mapLogToRow(userId, normalized);
  const { data, error } = await client
    .from('cycle_logs')
    .upsert(payload, { onConflict: 'user_id,log_date' })
    .select('log_date, bleeding_level, symptoms, note, created_at, updated_at')
    .single();

  if (error) throw error;
  return mapRowToLog(data);
}

/**
 * Delete one cycle log by local YYYY-MM-DD date for the signed-in user.
 * @param {string} dateKey
 */
export async function deleteCycleLogRemote(dateKey) {
  const { client, userId } = await requireUserId();
  const [normalized] = normalizeCycleLogs([{ date: dateKey }]);
  if (!normalized || normalized.date !== dateKey) {
    throw new Error('Invalid date key');
  }

  const { error } = await client
    .from('cycle_logs')
    .delete()
    .eq('user_id', userId)
    .eq('log_date', dateKey);

  if (error) throw error;
  return true;
}
