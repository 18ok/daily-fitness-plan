import React, { useMemo, useState } from 'react';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import { BottomNavigation } from './components/BottomNavigation';
import { Header } from './components/Header';
import { PlanCalendar } from './features/calendar/PlanCalendar';
import { LibraryPage } from './features/library/LibraryPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { RecordPage } from './features/record/RecordPage';
import { StickersPage } from './features/stickers/StickersPage';
import { localDateKey } from './lib/careHistory';
import { normalizeCycleLogs } from './lib/cycleTracking';
import { getCycleTrainingAdjustment } from './lib/cycleTrainingAdjustment';
import { normalizeExerciseHistory } from './lib/exerciseHistory';
import { normalizeTrainingProfile } from './lib/trainingProfile';
import { buildAdaptiveWorkout } from './features/today/adaptiveWorkout';
import { buildPlan } from './features/today/planBuilder';
import { TodayPage } from './features/today/TodayPage';

function normalizeAdaptiveTrainingProfile(value) {
  const profile = normalizeTrainingProfile(value);
  const equipment = value && typeof value === 'object' && value.equipment && typeof value.equipment === 'object'
    ? value.equipment
    : {};

  return {
    ...profile,
    equipment: { ...profile.equipment, bodyweight: equipment.bodyweight === true },
    safetyFlag: value?.safetyFlag,
  };
}

function App() {
  const [activeTab, setActiveTab] = useState('today');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [storedState, setState] = useLocalStorageState('today-plan-state', {
    time: '30分钟',
    status: '夜班后',
    condition: '健身房',
  });
  const [trainingProfile, setTrainingProfile] = useLocalStorageState('training-profile', {});
  const [bodyTrendHistory, setBodyTrendHistory] = useLocalStorageState('body-trend-history', []);
  const [exerciseHistory, setExerciseHistory] = useLocalStorageState('exercise-session-history', []);
  const [cycleLogs, setCycleLogs] = useLocalStorageState('cycle-logs', []);
  const state = storedState && typeof storedState === 'object' ? storedState : {};
  const normalizedTrainingProfile = useMemo(
    () => normalizeAdaptiveTrainingProfile(trainingProfile),
    [trainingProfile],
  );
  const normalizedExerciseHistory = useMemo(() => normalizeExerciseHistory(exerciseHistory), [exerciseHistory]);
  const normalizedCycleLogs = useMemo(() => normalizeCycleLogs(cycleLogs), [cycleLogs]);
  const todayCycleLog = useMemo(
    () => normalizedCycleLogs.find((entry) => entry.date === localDateKey()) || null,
    [normalizedCycleLogs],
  );
  const cycleAdjustment = useMemo(
    () => getCycleTrainingAdjustment(todayCycleLog),
    [todayCycleLog],
  );
  const plan = useMemo(
    () => buildPlan(state.time, state.status, state.condition),
    [state.condition, state.status, state.time],
  );
  const adaptiveWorkout = useMemo(
    () => buildAdaptiveWorkout({
      basePlan: plan,
      state,
      trainingProfile: normalizedTrainingProfile,
      exerciseHistory: normalizedExerciseHistory,
      cycleAdjustment,
    }),
    [cycleAdjustment, normalizedExerciseHistory, normalizedTrainingProfile, plan, state],
  );
  const isNightRecovery = state.status === '夜班后';

  return (
    <main className="app-stage">
      <div className={`mobile-shell ${isNightRecovery ? 'night-recovery' : ''}`}>
        <Header calendarOpen={calendarOpen} onCalendarToggle={() => setCalendarOpen((open) => !open)} />
        {calendarOpen ? (
          <PlanCalendar cycleLogs={cycleLogs} setCycleLogs={setCycleLogs} />
        ) : (
          <>
            {activeTab === 'today' && (
              <TodayPage
                adaptiveWorkout={adaptiveWorkout}
                exerciseHistory={normalizedExerciseHistory}
                plan={plan}
                setExerciseHistory={setExerciseHistory}
                setState={setState}
                state={state}
              />
            )}
            {activeTab === 'record' && <RecordPage state={state} />}
            {activeTab === 'library' && <LibraryPage state={state} setState={setState} setActiveTab={setActiveTab} />}
            {activeTab === 'stickers' && <StickersPage state={state} />}
            {activeTab === 'profile' && <ProfilePage />}
          </>
        )}

        {!calendarOpen && <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />}
      </div>
    </main>
  );
}

export default App;
