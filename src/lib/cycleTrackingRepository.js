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

export function mapCycleLogRow(row) {
  if (!row) return null;
  const [normalized] = normalizeCycleLogs([{
    date: row.log_date,
    bleedingLevel: row.bleeding_level ?? null,
    symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],
    note: typeof row.note === 'string' ? row.note : '',
    periodStatus: row.period_status ?? null,
    painLevel: row.pain_level ?? null,
    energyLevel: row.energy_level ?? null,
    sleepQuality: row.sleep_quality ?? null,
    redFlags: Array.isArray(row.red_flags) ? row.red_flags : [],
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  }]);
  return normalized || null;
}

export function mapCycleLogPayload(userId, log) {
  const [normalized] = normalizeCycleLogs([log]);
  if (!normalized) return null;
  return {
    user_id: userId,
    log_date: normalized.date,
    bleeding_level: normalized.bleedingLevel,
    symptoms: normalized.symptoms,
    note: normalized.note,
    period_status: normalized.periodStatus,
    pain_level: normalized.painLevel,
    energy_level: normalized.energyLevel,
    sleep_quality: normalized.sleepQuality,
    red_flags: normalized.redFlags,
    updated_at: normalized.updatedAt,
  };
}

const CYCLE_LOG_FIELDS = [
  'log_date',
  'bleeding_level',
  'symptoms',
  'note',
  'period_status',
  'pain_level',
  'energy_level',
  'sleep_quality',
  'red_flags',
  'created_at',
  'updated_at',
].join(', ');

/**
 * Fetch all cycle logs for the signed-in user.
 * @returns {Promise<Array>} normalized logs (empty array when none)
 */
export async function fetchCycleLogs() {
  const { client, userId } = await requireUserId();

  const { data, error } = await client
    .from('cycle_logs')
    .select(CYCLE_LOG_FIELDS)
    .eq('user_id', userId)
    .order('log_date', { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  return normalizeCycleLogs(data.map(mapCycleLogRow));
}

/**
 * Upsert one cycle log for the signed-in user (unique on user_id + log_date).
 * @param {object} log
 */
export async function upsertCycleLogRemote(log) {
  const { client, userId } = await requireUserId();
  const [normalized] = normalizeCycleLogs([log]);
  if (!normalized) throw new Error('Invalid cycle log');

  const payload = mapCycleLogPayload(userId, normalized);
  if (!payload) throw new Error('Invalid cycle log');
  const { data, error } = await client
    .from('cycle_logs')
    .upsert(payload, { onConflict: 'user_id,log_date' })
    .select(CYCLE_LOG_FIELDS)
    .single();

  if (error) throw error;
  return mapCycleLogRow(data);
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
