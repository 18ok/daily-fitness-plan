import { supabase } from './supabaseClient';

export const SNAPSHOT_KEYS = [
  'today-plan-saved',
  'today-plan-state',
  'daily-plan-history',
  'record-checks',
  'record-energy',
  'record-appetite',
  'record-saved',
  'care-history',
  'sticker-favorites',
  'profile-protect-mode',
  'profile-night-mode',
  'profile-reminder-time',
  'profile-training-preference',
  'profile-food-preference',
  'profile',
];

function readJsonValue(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function collectLocalSnapshot() {
  return SNAPSHOT_KEYS.reduce((snapshot, key) => {
    const value = readJsonValue(key);
    if (value !== undefined) snapshot[key] = value;
    return snapshot;
  }, {});
}

export function restoreLocalSnapshot(data) {
  if (!data || typeof data !== 'object') return;
  Object.entries(data).forEach(([key, value]) => {
    if (!SNAPSHOT_KEYS.includes(key)) return;
    localStorage.setItem(key, JSON.stringify(value));
  });
}

export async function downloadSnapshot(userId) {
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase
    .from('app_snapshots')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function uploadSnapshot(userId) {
  if (!supabase) throw new Error('Supabase is not configured');

  const payload = {
    user_id: userId,
    data: collectLocalSnapshot(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('app_snapshots').upsert(payload);
  if (error) throw error;
  return payload;
}
