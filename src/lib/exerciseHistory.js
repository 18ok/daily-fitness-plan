const FEEDBACK_VALUES = ['too_easy', 'just_right', 'somewhat_hard', 'uncomfortable'];

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeSet(value) {
  const plannedReps = Number(value?.plannedReps);
  const completedReps = Number(value?.completedReps);
  if (!Number.isInteger(plannedReps) || !Number.isInteger(completedReps)
    || plannedReps < 1 || plannedReps > 30 || completedReps < 1 || completedReps > 30) {
    return null;
  }
  return { plannedReps, completedReps };
}

function normalizeExerciseLog(value) {
  const exerciseId = typeof value?.exerciseId === 'string' ? value.exerciseId.trim().slice(0, 120) : '';
  if (!exerciseId || !isValidDate(value?.date) || !FEEDBACK_VALUES.includes(value?.feedback)) return null;

  const load = Number(value.loadKg);
  const loadKg = Number.isFinite(load) && load > 0 && load <= 100 ? load : null;
  const sets = Array.isArray(value.sets) ? value.sets.map(normalizeSet).filter(Boolean).slice(0, 5) : [];

  return {
    exerciseId,
    date: value.date,
    feedback: value.feedback,
    loadKg,
    sets,
    note: typeof value.note === 'string' ? value.note.slice(0, 120) : '',
  };
}

export function normalizeExerciseHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeExerciseLog).filter(Boolean);
}

export function recentExerciseHistory(history, exerciseId, limit = 3) {
  if (typeof exerciseId !== 'string' || !exerciseId.trim()) return [];
  const maxEntries = Number.isInteger(limit) && limit > 0 ? limit : 3;

  return normalizeExerciseHistory(history)
    .filter((entry) => entry.exerciseId === exerciseId)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, maxEntries);
}

function normalizeAvailableLoads(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map(Number)
    .filter((load) => Number.isFinite(load) && load > 0 && load <= 100))]
    .sort((left, right) => left - right);
}

function currentOwnedLoad(loads, previousLoad) {
  const load = Number(previousLoad);
  if (!Number.isFinite(load) || load <= 0) return loads[0];
  return loads.filter((ownedLoad) => ownedLoad <= load).at(-1) ?? loads[0];
}

function lowerOwnedLoad(loads, previousLoad) {
  const load = Number(previousLoad);
  if (!Number.isFinite(load) || load <= 0) return loads[0];
  return loads.filter((ownedLoad) => ownedLoad < load).at(-1) ?? loads[0];
}

function completedAllSets(sets) {
  return Array.isArray(sets) && sets.length > 0 && sets.every((set) => {
    const plannedReps = Number(set?.plannedReps);
    const completedReps = Number(set?.completedReps);
    return Number.isFinite(plannedReps) && plannedReps > 0 && Number.isFinite(completedReps) && completedReps >= plannedReps;
  });
}

export function recommendNextLoad({ availableLoads, previousLog, todayMode } = {}) {
  if (todayMode === 'suggest_rest') return { loadKg: null, action: 'stop', reason: '今天先不加重量' };

  const loads = normalizeAvailableLoads(availableLoads);
  if (loads.length === 0) return { loadKg: null, action: 'bodyweight', reason: '先用徒手版本试一组' };
  if (!previousLog || !FEEDBACK_VALUES.includes(previousLog.feedback)) {
    return { loadKg: loads[0], action: 'start', reason: '先从最小可用档位试一组' };
  }

  const currentLoad = currentOwnedLoad(loads, previousLog.loadKg);
  const lowerLoad = lowerOwnedLoad(loads, previousLog.loadKg);
  const fullyCompleted = completedAllSets(previousLog.sets);

  if (previousLog.feedback === 'too_easy') {
    const nextLoad = loads.find((load) => load > Number(previousLog.loadKg));
    if (fullyCompleted && nextLoad) return { loadKg: nextLoad, action: 'increase', reason: '上次完成稳定且太轻松' };
    return {
      loadKg: currentLoad,
      action: 'keep',
      reason: fullyCompleted ? '已是当前最大可用档位，先保持重量' : '上次尚未稳定完成，先保持重量',
    };
  }

  if (previousLog.feedback === 'just_right') {
    return { loadKg: currentLoad, action: 'keep', reason: '上次感觉刚好，保持当前重量' };
  }

  if (previousLog.feedback === 'somewhat_hard') {
    if (fullyCompleted) return { loadKg: currentLoad, action: 'keep', reason: '上次有些吃力，先保持当前重量' };
    if (lowerLoad < currentLoad) return { loadKg: lowerLoad, action: 'decrease', reason: '上次没有稳定完成，先降一档' };
    return { loadKg: currentLoad, action: 'keep', reason: '已是最小可用档位，先保持重量' };
  }

  if (lowerLoad < currentLoad) return { loadKg: lowerLoad, action: 'decrease', reason: '上次不舒服，先降一档' };
  return { loadKg: currentLoad, action: 'keep', reason: '已是最小可用档位，先保持重量' };
}

export function upsertExerciseLog(history, log) {
  const normalizedLog = normalizeExerciseLog(log);
  const normalizedHistory = normalizeExerciseHistory(history);
  if (!normalizedLog) return normalizedHistory;

  return [
    normalizedLog,
    ...normalizedHistory.filter((entry) => entry.exerciseId !== normalizedLog.exerciseId || entry.date !== normalizedLog.date),
  ].sort((left, right) => right.date.localeCompare(left.date));
}
