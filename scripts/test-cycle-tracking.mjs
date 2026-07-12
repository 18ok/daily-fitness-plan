import assert from 'node:assert/strict';
import {
  normalizeCycleLogs,
  upsertCycleLog,
  removeCycleLog,
  derivePeriodStarts,
  calculateCycleSummary,
} from '../src/lib/cycleTracking.js';
import { getCycleTrainingAdjustment } from '../src/lib/cycleTrainingAdjustment.js';

function bleeding(date, level = 'medium') {
  return { date, bleedingLevel: level, symptoms: [], note: '' };
}

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

run('consecutive bleeding days group into one period start', () => {
  const logs = [
    bleeding('2026-03-01'),
    bleeding('2026-03-02'),
    bleeding('2026-03-03'),
    bleeding('2026-03-20'),
  ];
  assert.deepEqual(derivePeriodStarts(logs), ['2026-03-01', '2026-03-20']);
});

run('cross-month consecutive bleeding stays one period', () => {
  const logs = [bleeding('2026-01-30'), bleeding('2026-01-31'), bleeding('2026-02-01')];
  assert.deepEqual(derivePeriodStarts(logs), ['2026-01-30']);
});

run('cross-year consecutive bleeding stays one period', () => {
  const logs = [bleeding('2025-12-30'), bleeding('2025-12-31'), bleeding('2026-01-01')];
  assert.deepEqual(derivePeriodStarts(logs), ['2025-12-30']);
});

run('leap year Feb 29 is accepted and groups correctly', () => {
  const logs = [bleeding('2024-02-28'), bleeding('2024-02-29'), bleeding('2024-03-01')];
  assert.deepEqual(derivePeriodStarts(logs), ['2024-02-28']);
  const normalized = normalizeCycleLogs([bleeding('2024-02-29')]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].date, '2024-02-29');
});

run('regular cycles produce median and next date range', () => {
  // Starts every 28 days: Jan 1, Jan 29, Feb 26, Mar 26
  const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'];
  const logs = starts.map((date) => bleeding(date));
  const summary = calculateCycleSummary(logs);
  assert.equal(summary.status, 'ok');
  assert.deepEqual(summary.cycleLengths, [28, 28, 28]);
  assert.equal(summary.medianCycleLength, 28);
  assert.deepEqual(summary.lengthRange, { min: 28, max: 28 });
  assert.deepEqual(summary.nextEstimate, {
    start: '2026-04-21',
    end: '2026-04-25',
    uncertaintyDays: 2,
  });
  assert.equal(summary.disclaimer, 'personal_record_estimate_not_diagnosis');
});

run('irregular cycles return range not a single forced day', () => {
  // Lengths: 26, 30, 28
  const starts = ['2026-01-01', '2026-01-27', '2026-02-26', '2026-03-26'];
  const logs = starts.map((date) => bleeding(date));
  const summary = calculateCycleSummary(logs);
  assert.equal(summary.status, 'ok');
  assert.deepEqual(summary.cycleLengths, [26, 30, 28]);
  assert.equal(summary.medianCycleLength, 28);
  assert.deepEqual(summary.lengthRange, { min: 26, max: 30 });
  assert.deepEqual(summary.nextEstimate, {
    start: '2026-04-21',
    end: '2026-04-25',
    uncertaintyDays: 2,
  });
  assert.notEqual(summary.nextEstimate.start, summary.nextEstimate.end);
});

run('fewer than 2 period starts returns insufficient_data', () => {
  const none = calculateCycleSummary([]);
  assert.equal(none.status, 'insufficient_data');
  assert.equal(none.nextEstimate, null);
  assert.equal(none.medianCycleLength, null);

  const one = calculateCycleSummary([bleeding('2026-05-01'), bleeding('2026-05-02')]);
  assert.equal(one.status, 'insufficient_data');
  assert.deepEqual(one.periodStarts, ['2026-05-01']);
  assert.equal(one.nextEstimate, null);
});

run('same-day upsert overwrites previous log', () => {
  let logs = [bleeding('2026-06-01', 'light')];
  logs = upsertCycleLog(logs, {
    date: '2026-06-01',
    bleedingLevel: 'heavy',
    symptoms: ['cramps'],
    note: 'updated',
    updatedAt: '2026-06-01T12:00:00.000Z',
  });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].bleedingLevel, 'heavy');
  assert.deepEqual(logs[0].symptoms, ['cramps']);
  assert.equal(logs[0].note, 'updated');
});

run('removing a log can split or reduce period starts', () => {
  let logs = [
    bleeding('2026-07-01'),
    bleeding('2026-07-02'),
    bleeding('2026-07-10'),
    bleeding('2026-07-20'),
  ];
  assert.deepEqual(derivePeriodStarts(logs), ['2026-07-01', '2026-07-10', '2026-07-20']);

  logs = removeCycleLog(logs, '2026-07-10');
  assert.deepEqual(derivePeriodStarts(logs), ['2026-07-01', '2026-07-20']);

  logs = removeCycleLog(logs, '2026-07-02');
  assert.deepEqual(derivePeriodStarts(logs), ['2026-07-01', '2026-07-20']);
});

run('invalid inputs return safe empty results without throwing', () => {
  assert.deepEqual(normalizeCycleLogs(null), []);
  assert.deepEqual(normalizeCycleLogs([{ date: 'not-a-date', bleedingLevel: 'heavy' }]), []);
  assert.deepEqual(normalizeCycleLogs([{ date: '2026-02-30', bleedingLevel: 'light' }]), []);
  assert.deepEqual(upsertCycleLog(null, { date: 'bad' }), []);
  assert.deepEqual(removeCycleLog(null, 'bad'), []);
  assert.deepEqual(derivePeriodStarts(undefined), []);
  const summary = calculateCycleSummary({ nope: true });
  assert.equal(summary.status, 'insufficient_data');
  assert.equal(summary.nextEstimate, null);
});

run('non-bleeding days do not create period starts', () => {
  const logs = [
    { date: '2026-08-01', bleedingLevel: null, symptoms: ['tired'], note: 'no bleed' },
    bleeding('2026-08-10'),
  ];
  assert.deepEqual(derivePeriodStarts(logs), ['2026-08-10']);
});

run('spotting alone does not create a period start', () => {
  const logs = [
    bleeding('2026-08-01', 'spotting'),
    bleeding('2026-08-10', 'light'),
    bleeding('2026-08-11', 'medium'),
  ];
  assert.deepEqual(derivePeriodStarts(logs), ['2026-08-10']);
});

run('explicit period status preserves continuous events and legacy starts', () => {
  const logs = [
    { date: '2026-06-01', periodStatus: 'started' },
    { date: '2026-06-02', periodStatus: 'ongoing', bleedingLevel: 'medium' },
    { date: '2026-06-03', periodStatus: 'ended' },
    bleeding('2026-06-29', 'heavy'),
  ];
  assert.deepEqual(derivePeriodStarts(logs), ['2026-06-01', '2026-06-29']);
});

run('extended wellbeing fields normalize safely without breaking legacy logs', () => {
  const extended = normalizeCycleLogs([{
    date: '2026-06-01',
    periodStatus: 'started',
    painLevel: 6,
    energyLevel: 3,
    sleepQuality: 'poor',
    redFlags: ['dizziness'],
  }])[0];
  assert.equal(extended.periodStatus, 'started');
  assert.equal(extended.painLevel, 6);
  assert.equal(extended.energyLevel, 3);
  assert.equal(extended.sleepQuality, 'poor');
  assert.deepEqual(extended.redFlags, ['dizziness']);
  assert.equal(typeof extended.updatedAt, 'string');

  const invalid = normalizeCycleLogs([{
    date: '2026-06-02',
    periodStatus: 'unknown',
    painLevel: 11,
    energyLevel: -1,
    sleepQuality: 'restless',
    redFlags: ['dizziness', 4],
  }])[0];
  assert.equal(invalid.periodStatus, null);
  assert.equal(invalid.painLevel, null);
  assert.equal(invalid.energyLevel, null);
  assert.equal(invalid.sleepQuality, null);
  assert.deepEqual(invalid.redFlags, ['dizziness']);

  const legacy = normalizeCycleLogs([bleeding('2026-06-03')])[0];
  assert.equal(legacy.periodStatus, null);
  assert.equal(legacy.painLevel, null);
  assert.equal(legacy.energyLevel, null);
  assert.equal(legacy.sleepQuality, null);
  assert.deepEqual(legacy.redFlags, []);
});

run('training adjustment follows conservative priority rules', () => {
  assert.equal(getCycleTrainingAdjustment({ painLevel: 7 }).level, 'suggest_rest');
  assert.equal(getCycleTrainingAdjustment({ redFlags: ['abnormal_bleeding'] }).level, 'suggest_rest');
  assert.equal(getCycleTrainingAdjustment({ painLevel: 4 }).level, 'recovery');
  assert.equal(getCycleTrainingAdjustment({ energyLevel: 2 }).level, 'recovery');
  assert.equal(getCycleTrainingAdjustment({ sleepQuality: 'poor' }).level, 'recovery');
  assert.equal(getCycleTrainingAdjustment({ energyLevel: 5 }).level, 'light');
  assert.equal(getCycleTrainingAdjustment({ symptoms: ['fatigue'] }).level, 'light');
  assert.equal(getCycleTrainingAdjustment({ energyLevel: 8, sleepQuality: 'good' }).level, 'normal');
  assert.equal(getCycleTrainingAdjustment({ painLevel: 8, energyLevel: 1 }).requiresCareNotice, true);
});

console.log('\nAll cycle tracking tests passed.');
