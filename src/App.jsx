import React, { useMemo, useState } from 'react';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import { BottomNavigation } from './components/BottomNavigation';
import { Header } from './components/Header';
import { PlanCalendar } from './features/calendar/PlanCalendar';
import { LibraryPage } from './features/library/LibraryPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { RecordPage } from './features/record/RecordPage';
import { StickersPage } from './features/stickers/StickersPage';
import { buildPlan } from './features/today/planBuilder';
import { TodayPage } from './features/today/TodayPage';

function App() {
  const [activeTab, setActiveTab] = useState('today');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [state, setState] = useLocalStorageState('today-plan-state', {
    time: '30分钟',
    status: '夜班后',
    condition: '健身房',
  });
  const plan = useMemo(() => buildPlan(state.time, state.status, state.condition), [state]);
  const isNightRecovery = state.status === '夜班后';

  return (
    <main className="app-stage">
      <div className={`mobile-shell ${isNightRecovery ? 'night-recovery' : ''}`}>
        <Header calendarOpen={calendarOpen} onCalendarToggle={() => setCalendarOpen((open) => !open)} />
        {calendarOpen ? (
          <PlanCalendar />
        ) : (
          <>
            {activeTab === 'today' && <TodayPage state={state} setState={setState} plan={plan} />}
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
