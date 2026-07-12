import assert from 'node:assert/strict';
import {
  availableDumbbellLoads,
  buildCakeTrendSummary,
  normalizeBodyTrendHistory,
  normalizeTrainingProfile,
} from '../src/lib/trainingProfile.js';
import {
  normalizeExerciseHistory,
  recentExerciseHistory,
  recommendNextLoad,
  upsertExerciseLog,
} from '../src/lib/exerciseHistory.js';
import { collectLocalSnapshot, restoreLocalSnapshot } from '../src/lib/syncSnapshot.js';
import { buildPlan } from '../src/features/today/planBuilder.js';
import { buildAdaptiveWorkout } from '../src/features/today/adaptiveWorkout.js';

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

run('training profile keeps only known values and safe dumbbell loads', () => {
  const profile = normalizeTrainingProfile({
    goals: ['habit', 'unknown', 'shape', 'habit'],
    experienceLevel: 'consistent',
    movementLimits: ['jump', 'core', 'horizontal_pull', 'stand_after_sitting', 'unknown', 'jump'],
    equipment: { bodyweight: true, dumbbellKg: [3, '2', 3, 11, -1, 101] },
    note: 'a'.repeat(121),
  });

  assert.deepEqual(profile.goals, ['habit', 'shape']);
  assert.equal(profile.experienceLevel, 'consistent');
  assert.deepEqual(profile.movementLimits, ['jump', 'core', 'horizontal_pull', 'stand_after_sitting']);
  assert.equal(profile.equipment.bodyweight, true);
  assert.equal(profile.note, 'a'.repeat(120));
  assert.deepEqual(availableDumbbellLoads(profile), [2, 3]);
});

run('training profile preserves normalized local-only setup details', () => {
  const profile = normalizeTrainingProfile({
    heightCm: '165.5',
    trainingPlaces: ['home', 'gym', 'unknown', 'home'],
    foodHabits: ['protein_first', 'unknown', 'protein_first'],
    equipment: {
      bands: true,
      kettlebell: true,
      gymMachines: true,
      customDumbbellKg: ['2.5', 12.5, 101, -1, 12.5],
      adjustableDumbbellRange: { minKg: '2', maxKg: '24' },
    },
  });

  assert.equal(profile.heightCm, 165.5);
  assert.deepEqual(profile.trainingPlaces, ['home', 'gym']);
  assert.deepEqual(profile.foodHabits, ['protein_first']);
  assert.equal(profile.equipment.bands, true);
  assert.equal(profile.equipment.kettlebell, true);
  assert.equal(profile.equipment.gymMachines, true);
  assert.deepEqual(profile.equipment.customDumbbellKg, [2.5, 12.5]);
  assert.deepEqual(profile.equipment.adjustableDumbbellRange, { minKg: 2, maxKg: 24 });
});

run('body trend history removes invalid dates and weights', () => {
  assert.deepEqual(normalizeBodyTrendHistory([
    { date: '2026-07-01', weightKg: 60 },
    { date: '2026-02-30', weightKg: 59.8 },
    { date: '2026-07-03', weightKg: 0 },
    { date: 'not-a-date', weightKg: 59.6 },
  ]), [{ date: '2026-07-01', weightKg: 60 }]);
});

run('cake trend summary labels the first stable week', () => {
  const summary = buildCakeTrendSummary({
    bodyTrendHistory: [{ date: '2026-07-01', weightKg: 60 }, { date: '2026-07-08', weightKg: 59.6 }],
    completedWorkouts: 2,
    foodHabitDays: 3,
  });

  assert.equal(summary.label, '稳稳变好的第 1 周');
  assert.deepEqual(summary.layers, [
    { key: 'body_trend', value: -0.4 },
    { key: 'completed_workouts', value: 2 },
    { key: 'food_habit_days', value: 3 },
  ]);
  assert.equal(summary.explanation, '这是你和自己的趋势对比，不是体脂测试，也不会决定你今天该练多重。');
});

run('exercise history accepts only valid feedback and five valid sets', () => {
  const normalized = normalizeExerciseHistory([
    {
      exerciseId: 'goblet-squat',
      date: '2026-07-08',
      feedback: 'just_right',
      loadKg: '3',
      sets: [
        { plannedReps: 8, completedReps: 8 },
        { plannedReps: 30, completedReps: 29 },
        { plannedReps: 31, completedReps: 30 },
        { plannedReps: 8, completedReps: 0 },
        { plannedReps: 8, completedReps: 8 },
        { plannedReps: 8, completedReps: 8 },
        { plannedReps: 8, completedReps: 8 },
      ],
      note: 'b'.repeat(121),
    },
    { exerciseId: 'goblet-squat', date: '2026-07-09', feedback: 'unknown' },
  ]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].loadKg, 3);
  assert.deepEqual(normalized[0].sets, [
    { plannedReps: 8, completedReps: 8 },
    { plannedReps: 30, completedReps: 29 },
    { plannedReps: 8, completedReps: 8 },
    { plannedReps: 8, completedReps: 8 },
    { plannedReps: 8, completedReps: 8 },
  ]);
  assert.equal(normalized[0].note, 'b'.repeat(120));
});

run('recent exercise history returns the latest three entries', () => {
  const history = [
    { exerciseId: 'row', date: '2026-07-01', feedback: 'just_right' },
    { exerciseId: 'row', date: '2026-07-02', feedback: 'just_right' },
    { exerciseId: 'row', date: '2026-07-03', feedback: 'just_right' },
    { exerciseId: 'row', date: '2026-07-04', feedback: 'just_right' },
    { exerciseId: 'press', date: '2026-07-05', feedback: 'just_right' },
  ];

  assert.deepEqual(recentExerciseHistory(history, 'row').map((entry) => entry.date), [
    '2026-07-04', '2026-07-03', '2026-07-02',
  ]);
});

run('next load increases only after stable too-easy completion', () => {
  assert.deepEqual(recommendNextLoad({
    availableLoads: [2, 3, 4],
    previousLog: {
      loadKg: 3,
      feedback: 'too_easy',
      sets: [{ plannedReps: 8, completedReps: 8 }, { plannedReps: 8, completedReps: 8 }],
    },
    todayMode: 'normal',
  }), { loadKg: 4, action: 'increase', reason: '上次完成稳定且太轻松' });
});

run('next load is conservative for difficult and unavailable loads', () => {
  assert.equal(recommendNextLoad({
    availableLoads: [2, 3, 4],
    previousLog: { loadKg: 3, feedback: 'uncomfortable', sets: [{ plannedReps: 8, completedReps: 5 }] },
    todayMode: 'normal',
  }).action, 'decrease');
  assert.deepEqual(recommendNextLoad({
    availableLoads: [2, 4],
    previousLog: { loadKg: 3, feedback: 'just_right', sets: [{ plannedReps: 8, completedReps: 8 }] },
    todayMode: 'normal',
  }), { loadKg: 2, action: 'keep', reason: '上次感觉刚好，保持当前重量' });
});

run('next load stops or starts with the required safe defaults', () => {
  assert.deepEqual(recommendNextLoad({ availableLoads: [2, 3], previousLog: null, todayMode: 'suggest_rest' }), {
    loadKg: null,
    action: 'stop',
    reason: '今天先不加重量',
  });
  assert.deepEqual(recommendNextLoad({ availableLoads: [], previousLog: null, todayMode: 'normal' }), {
    loadKg: null,
    action: 'bodyweight',
    reason: '先用徒手版本试一组',
  });
  assert.deepEqual(recommendNextLoad({ availableLoads: [3, 2, 2], previousLog: null, todayMode: 'normal' }), {
    loadKg: 2,
    action: 'start',
    reason: '先从最小可用档位试一组',
  });
});

run('upserting an exercise log replaces the matching date and exercise', () => {
  const history = upsertExerciseLog([
    { exerciseId: 'row', date: '2026-07-01', feedback: 'just_right', loadKg: 2 },
    { exerciseId: 'press', date: '2026-07-01', feedback: 'just_right', loadKg: 2 },
  ], {
    exerciseId: 'row', date: '2026-07-01', feedback: 'too_easy', loadKg: 3,
  });

  assert.equal(history.length, 2);
  assert.deepEqual(history[0], {
    exerciseId: 'row', date: '2026-07-01', feedback: 'too_easy', loadKg: 3, sets: [], note: '',
  });
});

run('adaptive workout replaces an avoided movement and starts from the smallest owned load', () => {
  const trainingProfile = normalizeTrainingProfile({
    goal: 'shape',
    experience: 'new',
    equipment: { bodyweight: true, dumbbellKg: [2, 3] },
    avoidMovements: ['squat'],
    safetyFlag: 'none',
  });
  const workout = buildAdaptiveWorkout({
    basePlan: buildPlan('30分钟', '白班', '家里'),
    state: { time: '30分钟', status: '白班', condition: '家里' },
    trainingProfile,
    exerciseHistory: [],
    cycleAdjustment: { level: 'normal' },
  });

  assert.deepEqual(trainingProfile.goals, ['shape']);
  assert.equal(trainingProfile.experienceLevel, 'new');
  assert.deepEqual(trainingProfile.movementLimits, ['squat']);
  assert.equal(workout.movements.some((item) => item.id === 'goblet_squat'), false);
  assert.equal(workout.movements.some((item) => item.replacement?.includes('自重')), true);
  assert.equal(workout.movements[0].suggestedLoad.loadKg, 2);
});

run('adaptive workout suggests rest for a safety flag', () => {
  const workout = buildAdaptiveWorkout({
    basePlan: buildPlan('30分钟', '白班', '家里'),
    state: { time: '30分钟', status: '白班', condition: '家里' },
    trainingProfile: normalizeTrainingProfile({ goals: ['shape'] }),
    exerciseHistory: [],
    cycleAdjustment: { level: 'suggest_rest' },
  });

  assert.equal(workout.mode, 'suggest_rest');
  assert.equal(workout.movements.length, 0);
});

run('adaptive workout respects an explicit profile safety flag', () => {
  const workout = buildAdaptiveWorkout({
    basePlan: buildPlan('30分钟', '白班', '家里'),
    state: { time: '30分钟', status: '白班', condition: '家里' },
    trainingProfile: normalizeTrainingProfile({
      equipment: { bodyweight: true, dumbbellKg: [2] },
      safetyFlag: 'suggest_rest',
    }),
    exerciseHistory: [],
    cycleAdjustment: { level: 'normal' },
  });

  assert.equal(workout.mode, 'suggest_rest');
  assert.equal(workout.movements.length, 0);
});

run('adaptive workout requires an entered training capability before suggesting movements', () => {
  const workout = buildAdaptiveWorkout({
    basePlan: buildPlan('30分钟', '白班', '家里'),
    state: { time: '30分钟', status: '白班', condition: '家里' },
    trainingProfile: normalizeTrainingProfile({ goals: ['shape'] }),
    exerciseHistory: [],
    cycleAdjustment: { level: 'normal' },
  });

  assert.equal(workout.mode, 'suggest_rest');
  assert.equal(workout.movements.length, 0);
});

run('adaptive workout does not add bodyweight movements when only dumbbells are entered', () => {
  const workout = buildAdaptiveWorkout({
    basePlan: buildPlan('30分钟', '白班', '家里'),
    state: { time: '30分钟', status: '白班', condition: '家里' },
    trainingProfile: normalizeTrainingProfile({
      goals: ['shape'],
      equipment: { dumbbellKg: [2] },
    }),
    exerciseHistory: [],
    cycleAdjustment: { level: 'normal' },
  });

  assert.equal(workout.movements.some((item) => item.equipmentLabel === '自重'), false);
});

run('adaptive workout de-duplicates replacement movement ids', () => {
  const workout = buildAdaptiveWorkout({
    basePlan: buildPlan('30分钟', '白班', '家里'),
    state: { time: '30分钟', status: '白班', condition: '家里' },
    trainingProfile: normalizeTrainingProfile({
      goals: ['shape'],
      equipment: { bodyweight: true },
      movementLimits: ['squat'],
    }),
    exerciseHistory: [],
    cycleAdjustment: { level: 'normal' },
  });

  const ids = workout.movements.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
});

run('normalized bodyweight equipment reaches the adaptive composer', () => {
  const trainingProfile = normalizeTrainingProfile({
    equipment: { bodyweight: true, dumbbellKg: [2] },
  });
  const workout = buildAdaptiveWorkout({
    basePlan: buildPlan('30分钟', '白班', '家里'),
    state: { time: '30分钟', status: '白班', condition: '家里' },
    trainingProfile,
    exerciseHistory: [],
    cycleAdjustment: { level: 'normal' },
  });

  assert.equal(trainingProfile.equipment.bodyweight, true);
  assert.equal(workout.movements.some((item) => item.equipmentLabel === '自重'), true);
});

run('adaptive workout omits a limited core movement without a replacement', () => {
  const workout = buildAdaptiveWorkout({
    basePlan: buildPlan('45分钟', '白班', '家里'),
    state: { time: '45分钟', status: '白班', condition: '家里' },
    trainingProfile: normalizeTrainingProfile({
      equipment: { bodyweight: true, dumbbellKg: [2] },
      movementLimits: ['core'],
    }),
    exerciseHistory: [],
    cycleAdjustment: { level: 'normal' },
  });

  assert.equal(workout.movements.length > 0, true);
  assert.equal(workout.movements.some((item) => item.id === 'dead_bug'), false);
});

run('adaptive workout normalizes and omits a limited horizontal pull', () => {
  const trainingProfile = normalizeTrainingProfile({
    equipment: { bodyweight: true, dumbbellKg: [2] },
    avoidMovements: ['horizontal_pull'],
  });
  const workout = buildAdaptiveWorkout({
    basePlan: buildPlan('45分钟', '白班', '家里'),
    state: { time: '45分钟', status: '白班', condition: '家里' },
    trainingProfile,
    exerciseHistory: [],
    cycleAdjustment: { level: 'normal' },
  });

  assert.deepEqual(trainingProfile.movementLimits, ['horizontal_pull']);
  assert.equal(workout.movements.some((item) => item.id === 'dumbbell_row'), false);
});

run('fat loss food guide omits calories', () => {
  const workout = buildAdaptiveWorkout({
    basePlan: buildPlan('30分钟', '白班', '家里'),
    state: { time: '30分钟', status: '白班', condition: '家里' },
    trainingProfile: normalizeTrainingProfile({ goals: ['fat_loss_food'] }),
    exerciseHistory: [],
    cycleAdjustment: { level: 'normal' },
  });

  assert.equal('calories' in workout.mealGuide, false);
});

run('local snapshots omit training profiles and body records', () => {
  const originalStorage = globalThis.localStorage;
  const store = new Map([
    ['daily-plan-history', JSON.stringify([{ date: '2026-07-12' }])],
    ['training-profile', JSON.stringify({ goal: 'habit', heightCm: 165 })],
    ['body-trend-history', JSON.stringify([{ date: '2026-07-12', weightKg: 60 }])],
    ['exercise-session-history', JSON.stringify([{ exerciseId: 'squat' }])],
  ]);
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
  };

  try {
    const snapshot = collectLocalSnapshot();
    assert.deepEqual(snapshot['daily-plan-history'], [{ date: '2026-07-12' }]);
    assert.equal('training-profile' in snapshot, false);
    assert.equal('body-trend-history' in snapshot, false);
    assert.equal('exercise-session-history' in snapshot, false);
  } finally {
    globalThis.localStorage = originalStorage;
  }
});

run('snapshot restoration ignores sensitive training and body keys', () => {
  const originalStorage = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
  };

  try {
    restoreLocalSnapshot({
      'daily-plan-history': [{ date: '2026-07-12' }],
      'training-profile': { heightCm: 165 },
      'body-trend-history': [{ date: '2026-07-12', weightKg: 60 }],
      'exercise-session-history': [{ exerciseId: 'squat' }],
    });

    assert.deepEqual(JSON.parse(store.get('daily-plan-history')), [{ date: '2026-07-12' }]);
    assert.equal(store.has('training-profile'), false);
    assert.equal(store.has('body-trend-history'), false);
    assert.equal(store.has('exercise-session-history'), false);
  } finally {
    globalThis.localStorage = originalStorage;
  }
});

run('light and recovery workouts use at most two sets per movement', () => {
  ['light', 'recovery'].forEach((level) => {
    const workout = buildAdaptiveWorkout({
      basePlan: buildPlan('30分钟', '白班', '家里'),
      state: { time: '30分钟', status: '白班', condition: '家里' },
      trainingProfile: normalizeTrainingProfile({
        goals: ['shape'],
        equipment: { bodyweight: true },
      }),
      exerciseHistory: [],
      cycleAdjustment: { level },
    });

    assert.equal(workout.movements.length > 0, true);
    assert.equal(workout.movements.every((item) => item.sets <= 2), true);
  });
});

console.log('\nAll adaptive training tests passed.');
