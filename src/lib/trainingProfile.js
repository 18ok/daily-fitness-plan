export const TRAINING_GOALS = ['habit', 'shape', 'fat_loss_food'];
export const EXPERIENCE_LEVELS = ['new', 'occasional', 'consistent'];
export const AVOID_MOVEMENTS = ['squat', 'hinge', 'overhead_press', 'horizontal_pull', 'horizontal_push', 'core', 'jump', 'stand_after_sitting'];
export const DUMBBELL_PRESETS = [0.5, 1, 1.5, 2, 3, 4, 5, 7.5, 10];
const SAFETY_FLAGS = ['none', 'suggest_rest'];

const CAKE_EXPLANATION = '这是你和自己的趋势对比，不是体脂测试，也不会决定你今天该练多重。';

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function knownValues(values, allowed) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => allowed.includes(value)))];
}

function knownValuesWithAlias(values, alias, allowed) {
  const aliasValues = typeof alias === 'string' ? [alias] : alias;
  return [...new Set([...knownValues(values, allowed), ...knownValues(aliasValues, allowed)])];
}

function cleanText(value) {
  return typeof value === 'string' ? value.slice(0, 120) : '';
}

function normalizedPresetLoads(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map(Number)
    .filter((load) => DUMBBELL_PRESETS.includes(load) && load > 0 && load <= 100))]
    .sort((left, right) => left - right);
}

function normalizedSafetyFlag(value) {
  if (value === true) return true;
  return SAFETY_FLAGS.includes(value) ? value : 'none';
}

export function normalizeTrainingProfile(value) {
  const profile = value && typeof value === 'object' ? value : {};
  const equipment = profile.equipment && typeof profile.equipment === 'object' ? profile.equipment : {};

  return {
    goals: knownValuesWithAlias(profile.goals, profile.goal, TRAINING_GOALS),
    experienceLevel: EXPERIENCE_LEVELS.includes(profile.experienceLevel)
      ? profile.experienceLevel
      : (EXPERIENCE_LEVELS.includes(profile.experience) ? profile.experience : 'new'),
    movementLimits: knownValuesWithAlias(profile.movementLimits, profile.avoidMovements, AVOID_MOVEMENTS),
    equipment: {
      bodyweight: equipment.bodyweight === true,
      dumbbellKg: normalizedPresetLoads(equipment.dumbbellKg),
    },
    safetyFlag: normalizedSafetyFlag(profile.safetyFlag),
    note: cleanText(profile.note),
  };
}

export function availableDumbbellLoads(profile) {
  const equipment = profile && typeof profile === 'object' && profile.equipment && typeof profile.equipment === 'object'
    ? profile.equipment
    : {};
  return normalizedPresetLoads(equipment.dumbbellKg);
}

export function normalizeBodyTrendHistory(value) {
  if (!Array.isArray(value)) return [];

  const byDate = new Map();
  value.forEach((entry) => {
    const weightKg = Number(entry?.weightKg);
    if (isValidDate(entry?.date) && Number.isFinite(weightKg) && weightKg > 0 && weightKg <= 500) {
      byDate.set(entry.date, { date: entry.date, weightKg });
    }
  });

  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function weekNumber(history) {
  if (history.length < 2) return 1;
  const first = Date.parse(`${history[0].date}T00:00:00Z`);
  const last = Date.parse(`${history.at(-1).date}T00:00:00Z`);
  return Math.max(1, Math.floor((last - first) / (7 * 24 * 60 * 60 * 1000)));
}

export function buildCakeTrendSummary({ bodyTrendHistory, completedWorkouts, foodHabitDays } = {}) {
  const history = normalizeBodyTrendHistory(bodyTrendHistory);
  const firstWeight = history[0]?.weightKg;
  const latestWeight = history.at(-1)?.weightKg;
  const bodyTrend = history.length >= 2 ? Number((latestWeight - firstWeight).toFixed(1)) : null;

  return {
    label: `稳稳变好的第 ${weekNumber(history)} 周`,
    layers: [
      { key: 'body_trend', value: bodyTrend },
      { key: 'completed_workouts', value: count(completedWorkouts) },
      { key: 'food_habit_days', value: count(foodHabitDays) },
    ],
    explanation: CAKE_EXPLANATION,
  };
}
