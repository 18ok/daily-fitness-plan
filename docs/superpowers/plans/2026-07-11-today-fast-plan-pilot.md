# Today Fast Plan Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Today page into a first-visit explicit setup and returning-user one-tap confirmation flow, restore mobile pinch zoom, and collect constrained anonymous feedback from a friends-only web pilot.

**Architecture:** Keep `TodayPage` as the existing feature owner and preserve the current plan/history shapes. Add one feature-local feedback component and one feature-local feedback service, backed by an insert-only Supabase table and local retry queue. Continue using the current React/Vite, `buildPlan`, `ResultCard`, illustration, and smoke-test patterns.

**Tech Stack:** React 19, Vite 6, JavaScript ES modules, Playwright, Supabase JS 2, PostgreSQL/RLS, CSS.

## Global Constraints

- Do not restructure the application or split existing page ownership.
- Do not modify Record, Library, Stickers, Profile, Calendar, cycle data, authentication timing, or cloud snapshot shapes.
- Keep selections exactly `{ time, status, condition }` and keep the existing daily-plan history record format.
- Do not add exercise animations, an education page, a bottom sheet, Taro, or WeChat Mini Program code in this plan.
- Preserve the varied cat, rabbit, bear, frog, dog, and future illustration ecosystem; do not standardize on one mascot.
- Preserve float/breathe motion under `prefers-reduced-motion: no-preference`; illustrations must remain subordinate to text and the primary action.
- First-time users must explicitly touch all three selectors before seeing a plan.
- Returning users must see a plan immediately and confirm it with one tap.
- The confirmation action must save, must not toggle back to unsaved, and must replace the same-day record on reconfirmation.
- Feedback must not include names, phone numbers, WeChat IDs, cycle records, or other sensitive health data.
- Anonymous feedback clients may insert constrained rows but may not read, update, or delete table rows.
- Mobile content must support both vertical panning and pinch zoom.
- Every task follows RED-GREEN-REFACTOR and ends with the listed focused commit.

---

## File Map

- Modify `src/features/today/TodayPage.jsx`: first/return flow, in-place adjustment, automatic preview, confirmation semantics, feedback mount point.
- Modify `src/features/today/planBuilder.js`: return `null` for unsupported persisted selections instead of crashing or silently producing a standard plan.
- Modify `src/App.jsx`: pass a safe selection object to the plan builder and Today page.
- Modify `src/components/common/Sticker.jsx`: hide a missing illustration without leaving a broken-image box.
- Create `src/features/today/PilotFeedbackPrompt.jsx`: anonymous rating/note UI, local submission state, pending retry.
- Create `src/features/today/pilotFeedback.js`: feedback ID/payload validation and Supabase insertion boundary.
- Modify `src/styles/base.css`: Today flow, A+B composition, confirmation and feedback styles, pinch-zoom rule.
- Modify `src/styles/responsive.css`: mobile sizing, restrained illustration motion, thumb-reachable confirmation treatment.
- Modify `scripts/test-app-smoke.mjs`: first-visit, return, confirmation, zoom, illustration, and offline-feedback regression coverage.
- Modify `scripts/test-app-logic.mjs`: pure feedback identity/payload validation and repository boundary tests.
- Create `supabase/experience_feedback.sql`: constrained insert-only pilot feedback table and RLS policy.

---

### Task 1: Restore Mobile Pinch Zoom

**Files:**
- Modify: `scripts/test-app-smoke.mjs:68-72`
- Modify: `src/styles/base.css:163-173`

**Interfaces:**
- Consumes: the existing `.page-content` and `.sub-page` scroll containers.
- Produces: computed `touch-action` that includes both `pan-y` and `pinch-zoom`.

- [ ] **Step 1: Add the failing computed-style assertion**

Immediately after the existing `Today selector` visibility assertion in `scripts/test-app-smoke.mjs`, add:

```js
  const todayTouchAction = await page.locator('.page-content').evaluate((element) => getComputedStyle(element).touchAction);
  assert.match(todayTouchAction, /(^|\s)pan-y(\s|$)/, 'Today content should retain vertical touch scrolling');
  assert.match(todayTouchAction, /(^|\s)pinch-zoom(\s|$)/, 'Today content should allow pinch zoom');
```

- [ ] **Step 2: Run the smoke test and verify RED**

Run:

```powershell
npm run test:smoke
```

Expected: FAIL at `Today content should allow pinch zoom`; current computed value is `pan-y`.

- [ ] **Step 3: Make the minimal CSS fix**

In the shared mobile scroll-container rule in `src/styles/base.css`, replace:

```css
  touch-action: pan-y;
```

with:

```css
  touch-action: pan-y pinch-zoom;
```

Do not change viewport metadata or add `user-scalable`/`maximum-scale` restrictions.

- [ ] **Step 4: Run the smoke test and verify GREEN**

Run:

```powershell
npm run test:smoke
```

Expected: PASS, including the new touch-action assertions and all existing smoke checks.

- [ ] **Step 5: Commit**

```powershell
git add scripts/test-app-smoke.mjs src/styles/base.css
git commit -m "fix: restore mobile pinch zoom"
```

---

### Task 2: Replace Generate/Save With the Fast Today Flow

**Files:**
- Modify: `scripts/test-app-smoke.mjs:68-92`
- Modify: `scripts/test-app-smoke.mjs:166-175`
- Modify: `scripts/test-app-logic.mjs:1-100`
- Modify: `src/features/today/planBuilder.js:1-134`
- Modify: `src/App.jsx:1-36`
- Modify: `src/features/today/TodayPage.jsx:1-195`

**Interfaces:**
- Consumes: `state`, `setState`, `plan`, `upsertDailyPlan()`, `samePlanSelections()`, and the existing `daily-plan-history` key.
- Produces: first-visit explicit answers, returning-user automatic preview, `isAdjusting`, `canPreview`, and one-way confirmation with the existing daily history shape.

- [ ] **Step 1: Rewrite the first-visit smoke flow to describe the new behavior**

Replace the current Generate/Save smoke block with assertions equivalent to this exact flow:

```js
  await expectVisible(page.locator('.selector-panel'), 'Today first-visit selector');
  assert.equal(await page.locator('.today-panel').count(), 0, 'First visit should hide the plan before explicit answers');

  await page.getByRole('button', { name: '45分钟', exact: true }).click();
  await page.getByRole('button', { name: '白班', exact: true }).click();
  assert.equal(await page.locator('.today-panel').count(), 0, 'Two answers should not reveal a plan');

  await page.getByRole('button', { name: '家里', exact: true }).click();
  await expectVisible(page.locator('.today-panel'), 'Plan after the third explicit answer');
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem('daily-plan-history') || '[]')),
    [],
    'Preview should not write history before confirmation',
  );

  await page.getByRole('button', { name: '今天就按这个做', exact: true }).click();
  await expectVisible(page.getByRole('button', { name: '今天计划已确认', exact: true }), 'Confirmed plan state');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('daily-plan-history') || '[]')[0]?.saved === true);

  const confirmedHistory = await page.evaluate(() => JSON.parse(localStorage.getItem('daily-plan-history')));
  assert.equal(confirmedHistory.length, 1, 'Confirmation should write one same-day entry');
  assert.deepEqual(confirmedHistory[0].selections, { time: '45分钟', status: '白班', condition: '家里' });

  assert.equal(
    await page.getByRole('button', { name: '今天计划已确认', exact: true }).isDisabled(),
    true,
    'Confirmed action should be disabled instead of toggling back to unsaved',
  );
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem('daily-plan-history')).length),
    1,
    'Confirmed state must keep one same-day entry',
  );
  console.log('ok - first-visit Today preview and one-tap confirmation');
```

Update the reload block to expect the returning state:

```js
  await expectVisible(page.locator('.today-status-summary'), 'Returning selection summary');
  await expectVisible(page.locator('.today-panel'), 'Returning automatic plan preview');
  await expectVisible(page.getByRole('button', { name: '今天计划已确认', exact: true }), 'Restored confirmation state');
  assert.equal(await page.locator('.selector-panel').count(), 0, 'Returning users should not see expanded selectors by default');
```

Before closing the browser in the smoke script, add an isolated storage-failure page:

```js
  const storageFailureContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const storageFailurePage = await storageFailureContext.newPage();
  await storageFailurePage.addInitScript(() => {
    localStorage.clear();
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage disabled for smoke test', 'QuotaExceededError');
    };
  });
  await storageFailurePage.goto(origin, { waitUntil: 'networkidle' });
  await expectVisible(
    storageFailurePage.getByText('本次计划可以查看，但当前浏览器无法长期保存。', { exact: true }),
    'Storage-unavailable notice',
  );
  await storageFailureContext.close();
  console.log('ok - Today remains usable when localStorage writes fail');
```

Add this logic regression before the final success log in `scripts/test-app-logic.mjs`:

```js
run('invalid persisted selections do not generate a silent default plan', () => {
  assert.equal(buildPlan('unknown', '白班', '家里'), null);
  assert.equal(buildPlan('30分钟', 'unknown', '家里'), null);
  assert.equal(buildPlan('30分钟', '白班', 'unknown'), null);
});
```

- [ ] **Step 2: Run the smoke test and verify RED**

Run:

```powershell
npm run test:smoke
npm run test:app-logic
```

Expected: smoke FAILS because the current page shows `.today-panel` immediately and still exposes `生成今日计划` and `保存计划`; app logic FAILS because invalid status currently falls through to a standard plan.

- [ ] **Step 3: Make plan derivation safe for corrupt persisted selections**

In `src/features/today/planBuilder.js`, replace `conditionKey()` and the opening of `buildPlan()` with these guarded forms; leave the existing night/tired/rest/standard return branches below the opening intact:

```diff
+const supportedStatuses = new Set(['白班', '夜班后', '休息日', '很累']);
+
 function conditionKey(condition) {
   if (condition === '健身房') return 'gym';
   if (condition === '家里') return 'home';
-  return 'store';
+  if (condition === '速食便利店') return 'store';
+  return null;
 }

 function buildPlan(time, status, condition) {
-  const base = planLibrary[time][conditionKey(condition)];
+  const key = conditionKey(condition);
+  if (!planLibrary[time] || !key || !supportedStatuses.has(status)) return null;
+  const base = planLibrary[time][key];
   const nightShift = status === '夜班后';
   const tired = status === '很累';
   const rest = status === '休息日';
```

The code above replaces the existing declarations through `const rest = ...`; the existing `if (nightShift)`, `if (tired)`, `if (rest)`, and final standard return blocks remain immediately afterward.

In `src/App.jsx`, normalize the persisted container before reading fields:

```jsx
  const persistedSelections = useLocalStorageState('today-plan-state', {
    time: '30分钟',
    status: '夜班后',
    condition: '健身房',
  });
  const [storedState, setState] = persistedSelections;
  const state = storedState && typeof storedState === 'object' ? storedState : {};
  const plan = useMemo(
    () => buildPlan(state.time, state.status, state.condition),
    [state.condition, state.status, state.time],
  );
```

The existing render call remains:

```jsx
{activeTab === 'today' && <TodayPage state={state} setState={setState} plan={plan} />}
```

- [ ] **Step 4: Replace the old generation state with explicit-answer and adjustment state**

Change the React import to include `useState`:

```js
import React, { useRef, useState } from 'react';
```

Add this local capability check above `TodayPage`, then capture it once inside the component:

```js
function browserStorageAvailable() {
  try {
    const key = '__today_storage_check__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
```

```js
  const [storageAvailable] = useState(browserStorageAvailable);
```

Inside `TodayPage`, replace the existing `todayEntry`, `generated`, `saved`, and old `update` declarations with:

```js
  const validPlanHistory = Array.isArray(planHistory) ? planHistory.filter((entry) => entry?.date) : [];
  const todayEntry = validPlanHistory.find((entry) => entry.date === today);
  const isFirstVisit = validPlanHistory.length === 0 || !plan;
  const [touched, setTouched] = useState({ time: false, status: false, condition: false });
  const [isAdjusting, setIsAdjusting] = useState(isFirstVisit);
  const canPreview = Boolean(plan) && (!isFirstVisit || (touched.time && touched.status && touched.condition));
  const confirmed = samePlanSelections(todayEntry?.selections, state) && todayEntry?.saved === true;

  const update = (key, value) => {
    setTouched((current) => ({ ...current, [key]: true }));
    setState((current) => ({
      ...(current && typeof current === 'object' ? current : {}),
      [key]: value,
    }));
  };
```

Keep `planRecord()`, but replace `generateTodayPlan()` and `toggleSavedPlan()` with:

```js
  function confirmTodayPlan() {
    if (!canPreview || confirmed) return;

    const confirmedAt = new Date().toISOString();
    setPlanHistory((current) =>
      upsertDailyPlan(
        current,
        planRecord({
          generatedAt: todayEntry?.generatedAt || confirmedAt,
          saved: true,
          savedAt: confirmedAt,
        }),
      ),
    );
    setIsAdjusting(false);
  }
```

- [ ] **Step 5: Render selectors only when first-use/adjusting and render the plan only when ready**

Add this active-state helper before the return, then replace the complete return block with the following JSX. This preserves all four existing result cards and illustrations while removing the old Generate and separate Save controls:

```jsx
  const selectionIsActive = (key, value) => (!isFirstVisit || touched[key]) && state[key] === value;

  return (
    <div className="page-content" ref={pageRef}>
      {isAdjusting && (
        <section className="selector-panel">
          <Sticker src={planCat} alt="魔法猫贴纸" className="peek-sticker" />
          <h1>{isFirstVisit ? '先告诉我今天的状态' : '调整今天的状态'}</h1>

          <ChoiceGroup title="今天有多少时间？">
            <div className="time-grid">
              {timeOptions.map((time) => (
                <button
                  className={`time-chip ${selectionIsActive('time', time) ? 'is-active' : ''}`}
                  key={time}
                  onClick={() => update('time', time)}
                  type="button"
                >
                  {time}
                </button>
              ))}
            </div>
          </ChoiceGroup>

          <ChoiceGroup title="今天的状态是？">
            <div className="option-grid four">
              {statusOptions.map((item) => (
                <OptionChip
                  active={selectionIsActive('status', item.label)}
                  icon={item.icon}
                  key={item.label}
                  label={item.label}
                  onClick={() => update('status', item.label)}
                />
              ))}
            </div>
          </ChoiceGroup>

          <ChoiceGroup title="今天怎么安排？">
            <div className="option-grid three">
              {conditionOptions.map((item) => (
                <OptionChip
                  active={selectionIsActive('condition', item.label)}
                  icon={item.icon}
                  key={item.label}
                  label={item.label}
                  onClick={() => update('condition', item.label)}
                />
              ))}
            </div>
          </ChoiceGroup>
        </section>
      )}

      {canPreview && (
        <div className="today-status-summary" aria-label="当前计划状态">
          <span>{state.time}</span>
          <span>{state.status}</span>
          <span>{state.condition}</span>
          <button onClick={() => setIsAdjusting(true)} type="button">调整</button>
        </div>
      )}

      {!storageAvailable && (
        <p className="today-storage-notice">本次计划可以查看，但当前浏览器无法长期保存。</p>
      )}

      {canPreview && (
        <section className="today-panel" ref={resultRef}>
          <div className="today-strategy">
            <span>你的今日重点</span>
            <h2>{plan.note}</h2>
            <p>{plan.trainingTitle} · {plan.foodTitle}</p>
          </div>

          <ResultCard
            tone="mint"
            icon={Dumbbell}
            title="训练"
            subtitle={plan.trainingTitle}
            detail={`${plan.training}｜${plan.trainingDetail}`}
            chips={['热身', '力量', '拉伸']}
            sticker={cheerRabbit}
            alt="加油兔子贴纸"
          />
          <ResultCard
            tone="lemon"
            icon={Utensils}
            title="吃饭"
            subtitle={plan.foodTitle}
            detail={plan.food}
            chips={state.condition === '速食便利店' ? ['便利店', '即食', '少油盐'] : ['高蛋白', '易消化', '少油盐']}
            sticker={foodCat}
            alt="吃饭猫贴纸"
          />
          <ResultCard
            tone="lavender"
            icon={ShieldCheck}
            title="最低线"
            detail="做到这 3 件事就很棒了"
            chips={plan.minimum}
            sticker={okBear}
            alt="OK小熊贴纸"
          />
          <ResultCard
            tone="pink"
            icon={Heart}
            title="不要做"
            detail="这几件事今天尽量避开"
            chips={plan.avoid}
            sticker={confusedFrog}
            alt="提醒贴纸"
          />

          <button
            className={`confirm-plan ${confirmed ? 'is-confirmed' : ''}`}
            disabled={confirmed}
            onClick={confirmTodayPlan}
            type="button"
          >
            <Save size={17} />
            {confirmed ? '今天计划已确认' : '今天就按这个做'}
          </button>
        </section>
      )}
    </div>
  );
```

Remove the obsolete `WandSparkles` import, `generate-button`, separate save button, and generated-state copy from JSX.

- [ ] **Step 6: Run smoke and logic tests and verify GREEN**

Run:

```powershell
npm run test:smoke
npm run test:app-logic
```

Expected: both commands PASS. The smoke output includes `ok - first-visit Today preview and one-tap confirmation`.

- [ ] **Step 7: Commit**

```powershell
git add src/App.jsx src/features/today/planBuilder.js src/features/today/TodayPage.jsx scripts/test-app-logic.mjs scripts/test-app-smoke.mjs
git commit -m "feat: streamline Today plan confirmation"
```

---

### Task 3: Apply the A+B In-Place Visual Treatment

**Files:**
- Modify: `scripts/test-app-smoke.mjs:68-100`
- Modify: `src/components/common/Sticker.jsx:1-3`
- Modify: `src/styles/base.css:197-680`
- Modify: `src/styles/responsive.css:35-174`

**Interfaces:**
- Consumes: `.today-status-summary`, `.today-strategy`, `.today-panel`, `.result-card`, `.card-sticker-frame`, and `.confirm-plan` from Task 2.
- Produces: results-first hierarchy, strong thumb-reachable confirmation, restrained illustrations, and unchanged reduced-motion behavior.

- [ ] **Step 1: Add structural visual assertions before styling**

After the plan becomes visible in the first-visit smoke flow, add:

```js
  await expectVisible(page.locator('.today-strategy'), 'Daily strategy summary');
  assert.equal(await page.locator('.today-panel .result-card').count(), 4, 'All four Today result cards should remain');
  assert.equal(await page.locator('.today-panel .card-sticker').count(), 4, 'All four explanatory illustrations should remain');

  const firstSticker = page.locator('.today-panel .card-sticker').first();
  await firstSticker.evaluate((image) => image.dispatchEvent(new Event('error')));
  await page.waitForFunction(() => document.querySelectorAll('.today-panel .card-sticker').length === 3);
  assert.equal(await page.locator('.today-panel .card-sticker').count(), 3, 'A missing illustration should disappear cleanly');

  const confirmBox = await page.getByRole('button', { name: '今天就按这个做', exact: true }).boundingBox();
  assert.ok(confirmBox, 'Primary confirmation should have a bounding box');
  assert.ok(confirmBox.width >= 300, 'Primary confirmation should remain easy to tap on a 390px mobile viewport');
```

- [ ] **Step 2: Run smoke and verify RED**

Run:

```powershell
npm run test:smoke
```

Expected: FAIL because the current `Sticker` component leaves the failed image mounted and the confirmation has no A+B styling.

- [ ] **Step 3: Hide missing illustration files without changing card copy**

Replace `src/components/common/Sticker.jsx` with:

```jsx
import React, { useEffect, useState } from 'react';

export function Sticker({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return null;

  return (
    <img
      alt={alt}
      className={`sticker ${className}`}
      draggable="false"
      onError={() => setFailed(true)}
      src={src}
    />
  );
}
```

- [ ] **Step 4: Add the exact A+B layout styles**

Delete the obsolete `.generate-button`, `.generate-button::before`, `.generate-button svg/span`, `.save-plan`, and `.save-plan.is-saved` rule blocks from `src/styles/base.css`. Remove `.generate-button` from the transition/hover/active selector lists in `src/styles/responsive.css`.

Then add these focused rules to the Today section of `src/styles/base.css`:

```css
.today-status-summary {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  margin: 10px 0;
}

.today-status-summary span,
.today-status-summary button {
  min-height: 34px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  font-weight: 720;
}

.today-status-summary button {
  color: var(--pink-deep);
}

.today-storage-notice {
  margin: 10px 0;
  padding: 9px 11px;
  border-radius: 12px;
  background: #fff7dd;
  color: #6f5a22;
  font-size: 12px;
  line-height: 1.45;
}

.today-strategy {
  margin-bottom: 10px;
  padding: 13px 14px;
  border: 1px solid rgba(237, 199, 211, 0.8);
  border-radius: 16px;
  background: linear-gradient(135deg, #fff0f4, #fff9e8);
}

.today-strategy span {
  color: var(--pink-deep);
  font-size: 11px;
  font-weight: 800;
}

.today-strategy h2 {
  margin: 4px 0;
  font-size: 17px;
  line-height: 1.35;
}

.today-strategy p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.confirm-plan {
  position: sticky;
  bottom: 8px;
  z-index: 8;
  width: 100%;
  min-height: 48px;
  margin-top: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 16px;
  background: linear-gradient(90deg, #f06d82, #f77e91);
  color: #fff;
  font-size: 16px;
  font-weight: 820;
  box-shadow: 0 12px 24px rgba(235, 101, 124, 0.25);
}

.confirm-plan.is-confirmed {
  background: #effbf4;
  color: #3b9c68;
  border: 1px solid #a9dfbd;
  box-shadow: none;
}

.today-panel .card-sticker-frame {
  opacity: 0.94;
}
```

Do not remove or replace the existing four `ResultCard` illustrations.

- [ ] **Step 5: Preserve restrained motion and reduced-motion behavior**

In `src/styles/responsive.css`, add `.confirm-plan` to the existing transition and active selectors:

```css
  .confirm-plan,
```

and:

```css
  .confirm-plan:active,
```

Keep the existing `sticker-breathe` distance at `2px`, `sticker-float` distance at `3px`, and existing animation durations. Do not add another continuous animation.

- [ ] **Step 6: Run smoke and verify GREEN**

Run:

```powershell
npm run test:smoke
```

Expected: PASS with four result cards, four illustrations, a visible strategy summary, and a wide primary action.

- [ ] **Step 7: Commit**

```powershell
git add src/components/common/Sticker.jsx src/styles/base.css src/styles/responsive.css scripts/test-app-smoke.mjs
git commit -m "style: clarify Today plan hierarchy"
```

---

### Task 4: Add the Constrained Pilot Feedback Boundary

**Files:**
- Modify: `scripts/test-app-logic.mjs:1-100`
- Create: `src/features/today/pilotFeedback.js`
- Create: `supabase/experience_feedback.sql`

**Interfaces:**
- Consumes: `selections: { time, status, condition }`, anonymous `clientId`, local date, and content version.
- Produces: `createPilotFeedbackId(input) -> string`, `buildPilotFeedback(input) -> DatabasePayload`, and `submitPilotFeedback(client, payload) -> Promise<void>`.

- [ ] **Step 1: Add failing pure feedback tests**

Add imports to `scripts/test-app-logic.mjs`:

```js
import {
  buildPilotFeedback,
  createPilotFeedbackId,
  submitPilotFeedback,
} from '../src/features/today/pilotFeedback.js';
```

Add the following tests before the final success log:

```js
run('pilot feedback identity is stable per exact plan', () => {
  const input = {
    clientId: 'client-123',
    date: '2026-07-11',
    contentVersion: 1,
    selections: { time: '30分钟', status: '白班', condition: '家里' },
  };
  assert.equal(
    createPilotFeedbackId(input),
    'client-123|2026-07-11|1|30分钟|白班|家里',
  );
});

run('pilot feedback payload excludes personal and cycle data', () => {
  assert.deepEqual(
    buildPilotFeedback({
      clientFeedbackId: 'client-123|2026-07-11|1|30分钟|白班|家里',
      rating: '太难',
      note: '  动作说明还不够具体。  ',
      selections: { time: '30分钟', status: '白班', condition: '家里' },
      contentVersion: 1,
      submittedAt: '2026-07-11T04:00:00.000Z',
    }),
    {
      client_feedback_id: 'client-123|2026-07-11|1|30分钟|白班|家里',
      rating: '太难',
      note: '动作说明还不够具体。',
      time_choice: '30分钟',
      status_choice: '白班',
      condition_choice: '家里',
      content_version: 1,
      submitted_at: '2026-07-11T04:00:00.000Z',
    },
  );
});

run('pilot feedback rejects unknown ratings and long notes', () => {
  const base = {
    clientFeedbackId: 'feedback-id',
    selections: { time: '30分钟', status: '白班', condition: '家里' },
    contentVersion: 1,
    submittedAt: '2026-07-11T04:00:00.000Z',
  };
  assert.throws(() => buildPilotFeedback({ ...base, rating: '一般', note: '' }), /Unsupported feedback rating/);
  assert.throws(() => buildPilotFeedback({ ...base, rating: '适合', note: 'x'.repeat(201) }), /Feedback note is too long/);
});

async function runAsync(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

await runAsync('pilot feedback repository inserts once', async () => {
  const calls = [];
  const client = {
    from(table) {
      return {
        async insert(payload) {
          calls.push({ table, payload });
          return { error: null };
        },
      };
    },
  };
  const payload = { client_feedback_id: 'feedback-id', rating: '适合' };
  await submitPilotFeedback(client, payload);
  assert.deepEqual(calls, [{ table: 'experience_feedback', payload }]);
});
```

- [ ] **Step 2: Run logic tests and verify RED**

Run:

```powershell
npm run test:app-logic
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `pilotFeedback.js`.

- [ ] **Step 3: Implement the feedback service**

Create `src/features/today/pilotFeedback.js`:

```js
export const PILOT_FEEDBACK_RATINGS = ['适合', '太难', '不符合状态'];

export function createPilotFeedbackId({ clientId, date, contentVersion, selections }) {
  return [clientId, date, contentVersion, selections.time, selections.status, selections.condition].join('|');
}

export function buildPilotFeedback({
  clientFeedbackId,
  rating,
  note = '',
  selections,
  contentVersion,
  submittedAt,
}) {
  if (!PILOT_FEEDBACK_RATINGS.includes(rating)) throw new Error('Unsupported feedback rating');

  const normalizedNote = note.trim();
  if (normalizedNote.length > 200) throw new Error('Feedback note is too long');
  if (!clientFeedbackId || clientFeedbackId.length > 180) throw new Error('Invalid feedback identity');
  if (!selections?.time || !selections?.status || !selections?.condition) throw new Error('Incomplete feedback selections');

  return {
    client_feedback_id: clientFeedbackId,
    rating,
    note: normalizedNote || null,
    time_choice: selections.time,
    status_choice: selections.status,
    condition_choice: selections.condition,
    content_version: contentVersion,
    submitted_at: submittedAt,
  };
}

export async function submitPilotFeedback(client, payload) {
  if (!client) throw new Error('Feedback service unavailable');
  const { error } = await client.from('experience_feedback').insert(payload);
  if (error && error.code !== '23505') throw error;
}
```

- [ ] **Step 4: Add the insert-only SQL migration**

Create `supabase/experience_feedback.sql`:

```sql
create table if not exists public.experience_feedback (
  id uuid primary key default gen_random_uuid(),
  client_feedback_id text not null unique,
  rating text not null,
  note text,
  time_choice text not null,
  status_choice text not null,
  condition_choice text not null,
  content_version integer not null,
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint experience_feedback_client_id_length
    check (char_length(client_feedback_id) between 1 and 180),
  constraint experience_feedback_rating
    check (rating in ('适合', '太难', '不符合状态')),
  constraint experience_feedback_note_length
    check (note is null or char_length(note) <= 200),
  constraint experience_feedback_content_version
    check (content_version > 0)
);

alter table public.experience_feedback enable row level security;

grant insert on table public.experience_feedback to anon, authenticated;
revoke select, update, delete on table public.experience_feedback from anon, authenticated;

drop policy if exists "pilot users can insert constrained feedback" on public.experience_feedback;
create policy "pilot users can insert constrained feedback"
on public.experience_feedback
for insert
to anon, authenticated
with check (
  char_length(client_feedback_id) between 1 and 180
  and rating in ('适合', '太难', '不符合状态')
  and (note is null or char_length(note) <= 200)
  and content_version > 0
);
```

- [ ] **Step 5: Run logic tests and verify GREEN**

Run:

```powershell
npm run test:app-logic
```

Expected: PASS, including all four new pilot feedback checks.

- [ ] **Step 6: Commit**

```powershell
git add scripts/test-app-logic.mjs src/features/today/pilotFeedback.js supabase/experience_feedback.sql
git commit -m "feat: add pilot feedback boundary"
```

---

### Task 5: Add the Anonymous Feedback Prompt and Offline Queue

**Files:**
- Create: `src/features/today/PilotFeedbackPrompt.jsx`
- Modify: `src/features/today/TodayPage.jsx:41-195`
- Modify: `src/styles/base.css:680+`
- Modify: `scripts/test-app-smoke.mjs:80-105`

**Interfaces:**
- Consumes: `confirmed`, `date`, `selections`, `contentVersion`, `supabase`, and Task 4 feedback functions.
- Produces: one rating/note prompt per exact confirmed plan, local pending queue, later automatic retry, and submitted/queued acknowledgment.

- [ ] **Step 1: Add a failing offline-feedback smoke flow**

After Today confirmation in `scripts/test-app-smoke.mjs`, add:

```js
  await expectVisible(page.getByText('这个计划适合你今天吗？', { exact: true }), 'Pilot feedback prompt');
  await page.getByRole('button', { name: '太难', exact: true }).click();
  await page.getByPlaceholder('可以补充一句，选填').fill('动作说明还不够具体');
  await page.getByRole('button', { name: '提交反馈', exact: true }).click();
  await expectVisible(page.getByText('反馈已保存在本机，联网后会自动提交。', { exact: true }), 'Queued feedback state');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('today-plan-feedback-pending') || 'null')?.rating === '太难');
  console.log('ok - anonymous pilot feedback queues without Supabase');
```

The smoke Vite server already uses `envFile: false`, so this deterministically tests the no-Supabase path.

- [ ] **Step 2: Run smoke and verify RED**

Run:

```powershell
npm run test:smoke
```

Expected: FAIL because the feedback prompt does not exist.

- [ ] **Step 3: Create the focused feedback component**

Create `src/features/today/PilotFeedbackPrompt.jsx`:

```jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { supabase } from '../../lib/supabaseClient';
import {
  PILOT_FEEDBACK_RATINGS,
  buildPilotFeedback,
  createPilotFeedbackId,
  submitPilotFeedback,
} from './pilotFeedback';

const createClientId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function PilotFeedbackPrompt({ confirmed, date, selections, contentVersion }) {
  const [clientId] = useLocalStorageState('pilot-feedback-client-id', createClientId());
  const [pending, setPending] = useLocalStorageState('today-plan-feedback-pending', null);
  const [submittedIds, setSubmittedIds] = useLocalStorageState('today-plan-feedback-submitted', []);
  const [rating, setRating] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  const feedbackId = useMemo(
    () => createPilotFeedbackId({ clientId, date, contentVersion, selections }),
    [clientId, contentVersion, date, selections],
  );
  const isQueued = pending?.client_feedback_id === feedbackId;
  const isSubmitted = submittedIds.includes(feedbackId);

  useEffect(() => {
    if (!pending || !supabase) return undefined;
    let cancelled = false;

    submitPilotFeedback(supabase, pending)
      .then(() => {
        if (cancelled) return;
        setSubmittedIds((current) => [...new Set([...current, pending.client_feedback_id])]);
        setPending(null);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pending, setPending, setSubmittedIds]);

  if (!confirmed) return null;

  async function handleSubmit() {
    const payload = buildPilotFeedback({
      clientFeedbackId: feedbackId,
      rating,
      note,
      selections,
      contentVersion,
      submittedAt: new Date().toISOString(),
    });

    try {
      await submitPilotFeedback(supabase, payload);
      setSubmittedIds((current) => [...new Set([...current, feedbackId])]);
      setPending(null);
      setMessage('谢谢你的反馈，已经收到。');
    } catch {
      setPending(payload);
      setMessage('反馈已保存在本机，联网后会自动提交。');
    }
  }

  if (isSubmitted) return <p className="pilot-feedback-status">谢谢你的反馈，已经收到。</p>;
  if (isQueued) return <p className="pilot-feedback-status">反馈已保存在本机，联网后会自动提交。</p>;

  return (
    <section className="pilot-feedback" aria-labelledby="pilot-feedback-title">
      <h3 id="pilot-feedback-title">这个计划适合你今天吗？</h3>
      <div className="pilot-feedback-options">
        {PILOT_FEEDBACK_RATINGS.map((item) => (
          <button
            className={rating === item ? 'is-active' : ''}
            key={item}
            onClick={() => setRating(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      <textarea
        maxLength={200}
        onChange={(event) => setNote(event.target.value)}
        placeholder="可以补充一句，选填"
        value={note}
      />
      <button className="pilot-feedback-submit" disabled={!rating} onClick={handleSubmit} type="button">
        提交反馈
      </button>
      {message && <p className="pilot-feedback-status">{message}</p>}
    </section>
  );
}
```

- [ ] **Step 4: Mount feedback only for an exact confirmed plan**

Import the component in `TodayPage.jsx`:

```js
import { PilotFeedbackPrompt } from './PilotFeedbackPrompt';
```

Immediately after the confirmation button inside `.today-panel`, add:

```jsx
<PilotFeedbackPrompt
  confirmed={confirmed}
  contentVersion={1}
  date={today}
  selections={state}
/>
```

- [ ] **Step 5: Add restrained feedback styles**

Add to the Today section of `src/styles/base.css`:

```css
.pilot-feedback {
  margin-top: 12px;
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.86);
}

.pilot-feedback h3 {
  margin: 0 0 9px;
  font-size: 14px;
}

.pilot-feedback-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}

.pilot-feedback-options button,
.pilot-feedback-submit {
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  color: var(--text);
  font-weight: 720;
}

.pilot-feedback-options button.is-active {
  border-color: var(--pink);
  background: #ffe9ef;
}

.pilot-feedback textarea {
  width: 100%;
  min-height: 66px;
  margin-top: 8px;
  padding: 10px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  color: var(--text);
}

.pilot-feedback-submit {
  width: 100%;
  margin-top: 8px;
  color: #fff;
  background: var(--pink-deep);
}

.pilot-feedback-submit:disabled {
  opacity: 0.45;
}

.pilot-feedback-status {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
npm run test:app-logic
npm run test:smoke
```

Expected: both PASS. Smoke includes `ok - anonymous pilot feedback queues without Supabase`; no page errors are added.

- [ ] **Step 7: Commit**

```powershell
git add src/features/today/PilotFeedbackPrompt.jsx src/features/today/TodayPage.jsx src/styles/base.css scripts/test-app-smoke.mjs
git commit -m "feat: collect Today pilot feedback"
```

---

### Task 6: Apply the Feedback Schema and Verify the Pilot Build

**Files:**
- Verify: `supabase/experience_feedback.sql`
- Verify: all files changed in Tasks 1-5

**Interfaces:**
- Consumes: a Supabase project matching the web app's configured URL/key.
- Produces: live `public.experience_feedback` insert-only table and a verified pilot build.

- [ ] **Step 1: Apply the SQL through the Supabase SQL Editor**

Open the Supabase project used by the web app, open SQL Editor, paste the complete contents of:

```text
supabase/experience_feedback.sql
```

Run it once.

Expected: `Success. No rows returned` and a new `public.experience_feedback` table.

Do not use or expose the service-role key in the web application.

- [ ] **Step 2: Verify RLS and privileges in the SQL Editor**

Run:

```sql
select relrowsecurity
from pg_class
where oid = 'public.experience_feedback'::regclass;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'experience_feedback'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;
```

Expected:

- `relrowsecurity = true`
- `anon` has `INSERT` only
- `authenticated` has `INSERT` only
- neither role has `SELECT`, `UPDATE`, or `DELETE`

- [ ] **Step 3: Run the complete fresh verification suite**

Run:

```powershell
npm run verify:maintenance
```

Expected:

- App logic tests pass, including pilot feedback tests.
- All 12 cycle tests pass.
- Smoke test passes, including first visit, return, zoom rule, illustrations, and queued feedback.
- Maintenance diff check passes.
- Vite production build exits `0`.

- [ ] **Step 4: Perform real-phone acceptance checks**

Start the web app:

```powershell
npm run dev
```

On at least one iPhone and one Android phone when available, verify this checklist:

```text
[ ] First visit does not silently accept the old defaults.
[ ] Three explicit answers reveal the plan without Generate.
[ ] Today confirmation saves once and cannot accidentally unsave.
[ ] Returning visit shows the plan immediately.
[ ] Adjust expands the existing controls in place.
[ ] Two-finger zoom-in and zoom-out both work.
[ ] Vertical scrolling and tapping still work after zooming.
[ ] All four existing illustrations are visible and do not cover copy/actions.
[ ] Float/breathe motion is subtle; reduced-motion disables it.
[ ] Feedback submits to Supabase when online.
[ ] Feedback queues locally when offline and retries later.
```

- [ ] **Step 5: Inspect the final repository state**

Run:

```powershell
git status --short --branch
git log --oneline -8
```

Expected: no tracked uncommitted changes. `.superpowers/` may remain as local untracked brainstorming output and must not be committed.

- [ ] **Step 6: Push the verified branch and open a PR**

Run from the implementation branch:

```powershell
git push -u origin HEAD
gh pr create --base main --title "feat: streamline Today pilot experience" --body "## Summary
- replaces Generate/Save with explicit first-use setup and one-tap confirmation
- restores mobile pinch zoom and preserves Today illustrations/motion
- adds constrained anonymous Supabase feedback with offline queue

## Verification
- npm run verify:maintenance
- real-phone pinch zoom and Today flow checks"
```

Expected: GitHub prints the new PR URL. Do not merge until the pilot build and Vercel preview are reviewed.

- [ ] **Step 7: Wait for checks and review the deployed preview**

Run:

```powershell
gh pr checks --watch
gh pr view --json mergeable,statusCheckRollup,url
```

Expected: all reported checks conclude `SUCCESS` and `mergeable` is `MERGEABLE`.

Open the Vercel preview URL reported by the check and repeat the 390px mobile Today flow. Confirm that production environment variables allow an online feedback submission after the SQL migration is live.

- [ ] **Step 8: Squash merge the approved pilot PR**

After the inline review and preview checks are clean, run:

```powershell
gh pr merge --squash --delete-branch
```

Expected: PR state becomes `MERGED` and the remote feature branch is deleted.

- [ ] **Step 9: Sync main and verify the production deployment status**

Run:

```powershell
git switch main
git pull --ff-only origin main
$sha = git rev-parse HEAD
gh api "repos/18ok/daily-fitness-plan/commits/$sha/status"
```

Expected: local `main` matches `origin/main`; the GitHub status response reaches `success` for the production Vercel deployment. Record the production URL for the friends-only pilot and begin Round 1 using the design spec's three-to-five-person checklist.
