const BLEEDING_LEVELS = new Set(['spotting', 'light', 'medium', 'heavy']);
const PERIOD_STATUSES = new Set(['started', 'ongoing', 'ended']);
const SLEEP_QUALITIES = new Set(['poor', 'normal', 'good']);
const RED_FLAG_TYPES = new Set(['dizziness', 'abnormal_bleeding']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseLocalDate(dateKey) {
  if (typeof dateKey !== 'string' || !DATE_RE.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function isValidDateKey(dateKey) {
  return parseLocalDate(dateKey) !== null;
}

function addDays(dateKey, days) {
  const date = parseLocalDate(dateKey);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

function daysBetween(startKey, endKey) {
  const start = parseLocalDate(startKey);
  const end = parseLocalDate(endKey);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function normalizeBleedingLevel(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  return BLEEDING_LEVELS.has(value) ? value : null;
}

function normalizeSymptoms(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeNote(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizePeriodStatus(value) {
  if (typeof value !== 'string') return null;
  return PERIOD_STATUSES.has(value) ? value : null;
}

function normalizeScore(value) {
  if (!Number.isInteger(value) || value < 0 || value > 10) return null;
  return value;
}

function normalizeSleepQuality(value) {
  if (typeof value !== 'string') return null;
  return SLEEP_QUALITIES.has(value) ? value : null;
}

function normalizeRedFlags(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && RED_FLAG_TYPES.has(item));
}

function hasBleeding(log) {
  const level = normalizeBleedingLevel(log?.bleedingLevel);
  return level === 'light' || level === 'medium' || level === 'heavy';
}

function median(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function normalizeOneLog(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (!isValidDateKey(entry.date)) return null;

  return {
    date: entry.date,
    bleedingLevel: normalizeBleedingLevel(entry.bleedingLevel),
    symptoms: normalizeSymptoms(entry.symptoms),
    note: normalizeNote(entry.note),
    periodStatus: normalizePeriodStatus(entry.periodStatus),
    painLevel: normalizeScore(entry.painLevel),
    energyLevel: normalizeScore(entry.energyLevel),
    sleepQuality: normalizeSleepQuality(entry.sleepQuality),
    redFlags: normalizeRedFlags(entry.redFlags),
    updatedAt: typeof entry.updatedAt === 'string' && entry.updatedAt ? entry.updatedAt : new Date().toISOString(),
  };
}

/**
 * Normalize and sort cycle logs. Invalid entries are dropped.
 * @param {unknown} logs
 * @returns {Array<{date: string, bleedingLevel: string|null, symptoms: string[], note: string, periodStatus: string|null, painLevel: number|null, energyLevel: number|null, sleepQuality: string|null, redFlags: string[], updatedAt: string}>}
 */
export function normalizeCycleLogs(logs) {
  if (!Array.isArray(logs)) return [];

  const byDate = new Map();
  for (const entry of logs) {
    const normalized = normalizeOneLog(entry);
    if (!normalized) continue;
    const existing = byDate.get(normalized.date);
    if (!existing || String(normalized.updatedAt).localeCompare(String(existing.updatedAt)) >= 0) {
      byDate.set(normalized.date, normalized);
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Insert or overwrite a log for the same local date.
 * @param {unknown} logs
 * @param {object} patch
 */
export function upsertCycleLog(logs, patch) {
  const current = normalizeCycleLogs(logs);
  const next = normalizeOneLog({
    ...patch,
    updatedAt: patch?.updatedAt || new Date().toISOString(),
  });
  if (!next) return current;

  return normalizeCycleLogs([...current.filter((item) => item.date !== next.date), next]);
}

/**
 * Remove a log by local date key.
 * @param {unknown} logs
 * @param {string} dateKey
 */
export function removeCycleLog(logs, dateKey) {
  if (!isValidDateKey(dateKey)) return normalizeCycleLogs(logs);
  return normalizeCycleLogs(logs).filter((item) => item.date !== dateKey);
}

/**
 * Group consecutive bleeding days into periods; return each period's first day.
 * @param {unknown} logs
 * @returns {string[]} YYYY-MM-DD period start dates, ascending
 */
export function derivePeriodStarts(logs) {
  const normalizedLogs = normalizeCycleLogs(logs);
  const starts = new Set(normalizedLogs
    .filter((item) => item.periodStatus === 'started')
    .map((item) => item.date));
  const bleedingLogs = normalizedLogs
    .filter(hasBleeding)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (bleedingLogs.length === 0) return [...starts].sort((a, b) => a.localeCompare(b));

  const groups = [];
  let currentGroup = [bleedingLogs[0]];
  let previous = bleedingLogs[0];

  for (let index = 1; index < bleedingLogs.length; index += 1) {
    const log = bleedingLogs[index];
    const gap = daysBetween(previous.date, log.date);
    if (gap === null || gap > 1) {
      groups.push(currentGroup);
      currentGroup = [log];
    } else {
      currentGroup.push(log);
    }
    previous = log;
  }
  groups.push(currentGroup);

  for (const group of groups) {
    if (!group.some((item) => item.periodStatus)) starts.add(group[0].date);
  }

  return [...starts].sort((a, b) => a.localeCompare(b));
}

function insufficientSummary(extra = {}) {
  return {
    status: 'insufficient_data',
    periodStarts: [],
    cycleLengths: [],
    medianCycleLength: null,
    lengthRange: null,
    nextEstimate: null,
    disclaimer: 'personal_record_estimate_not_diagnosis',
    ...extra,
  };
}

/**
 * Summarize recent cycle starts into median length, observed range, and next date range.
 * Needs at least 2 period starts. Never invents ovulation/fertility claims.
 * @param {unknown} logs
 */
export function calculateCycleSummary(logs) {
  try {
    const allStarts = derivePeriodStarts(logs);
    if (allStarts.length < 2) {
      return insufficientSummary({ periodStarts: allStarts });
    }

    const periodStarts = allStarts.slice(-6);
    const cycleLengths = [];

    for (let index = 1; index < periodStarts.length; index += 1) {
      const length = daysBetween(periodStarts[index - 1], periodStarts[index]);
      if (length != null && length > 0) cycleLengths.push(length);
    }

    if (cycleLengths.length === 0) {
      return insufficientSummary({ periodStarts });
    }

    const medianCycleLength = median(cycleLengths);
    const minLength = Math.min(...cycleLengths);
    const maxLength = Math.max(...cycleLengths);
    const lastStart = periodStarts[periodStarts.length - 1];
    const observedVariation = Math.max(
      ...cycleLengths.map((length) => Math.abs(length - medianCycleLength)),
    );
    const uncertaintyDays = Math.max(2, observedVariation);
    const estimatedCenter = addDays(lastStart, medianCycleLength);
    const rangeStart = estimatedCenter ? addDays(estimatedCenter, -uncertaintyDays) : null;
    const rangeEnd = estimatedCenter ? addDays(estimatedCenter, uncertaintyDays) : null;

    if (!rangeStart || !rangeEnd || medianCycleLength == null) {
      return insufficientSummary({ periodStarts, cycleLengths });
    }

    return {
      status: 'ok',
      periodStarts,
      cycleLengths,
      medianCycleLength,
      lengthRange: { min: minLength, max: maxLength },
      nextEstimate: {
        start: rangeStart,
        end: rangeEnd,
        uncertaintyDays,
      },
      disclaimer: 'personal_record_estimate_not_diagnosis',
    };
  } catch {
    return insufficientSummary();
  }
}
