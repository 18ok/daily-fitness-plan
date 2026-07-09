function pad(value) {
  return String(value).padStart(2, '0');
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shiftDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return localDateKey(new Date(year, month - 1, day + days));
}

function validHistory(history) {
  return Array.isArray(history) ? history.filter((entry) => entry?.date) : [];
}

export function upsertCareRecord(history, record) {
  return [...validHistory(history).filter((entry) => entry.date !== record.date), record].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

export function calculateCareStreak(history, now = new Date()) {
  const dates = new Set(validHistory(history).map((entry) => entry.date));
  const today = localDateKey(now);
  const yesterday = shiftDateKey(today, -1);
  let cursor = dates.has(today) ? today : dates.has(yesterday) ? yesterday : null;
  let streak = 0;

  while (cursor && dates.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  return streak;
}

export function countNightRecoveries(history) {
  return new Set(
    validHistory(history)
      .filter((entry) => entry.status === '夜班后')
      .map((entry) => entry.date),
  ).size;
}
