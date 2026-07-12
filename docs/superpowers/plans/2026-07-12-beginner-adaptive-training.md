# Beginner Adaptive Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给小白生成基于目标、实际器械、当天状态和历史反馈的具体动作与重量建议，并保存私密趋势、便签和动作对比。

**Architecture:** 纯模块处理训练资料、体重趋势、动作记录和负荷建议；现有 `buildPlan` 保留日程与基础饮食文案，新的 `buildAdaptiveWorkout` 追加动作卡。`App` 持有三项本地状态并传给 Profile/Today，身体资料不进入通用快照。

**Tech Stack:** React 19、Vite、localStorage、Node `assert`、Playwright。

## Global Constraints

- 小白界面不出现 RM、RIR、百分比强度、医学诊断和固定通用公斤数。
- 建议仅能使用用户录入的器械档位；首次用徒手或最小档位。
- 身高、体重、旧伤说明、动作限制和便签默认仅本机，不能加入 `SNAPSHOT_KEYS`。
- 自由文本不作病因推断；仅明确安全确认、既有红旗、显式动作限制可触发保护。
- 蛋糕只表示个人趋势与习惯，不评价体脂、胖瘦或外形，也不参与重量计算。
- 饮食只给盘餐法、蛋白质与真实场景选择，不算热量。
- 真实验证只使用默认 Edge；不接触 API Key。

---

### Task 1: 训练资料、动作历史与保守重量规则

**Files:**

- Create: `src/lib/trainingProfile.js`
- Create: `src/lib/exerciseHistory.js`
- Create: `scripts/test-adaptive-training.mjs`
- Modify: `package.json`

**Interfaces:**

```js
normalizeTrainingProfile(value)
availableDumbbellLoads(profile)
normalizeBodyTrendHistory(value)
buildCakeTrendSummary({ bodyTrendHistory, completedWorkouts, foodHabitDays })
normalizeExerciseHistory(value)
recentExerciseHistory(history, exerciseId, limit = 3)
recommendNextLoad({ availableLoads, previousLog, todayMode })
upsertExerciseLog(history, log)
```

- [ ] **Step 1: Write failing domain tests**

Create `scripts/test-adaptive-training.mjs` with the same `run(name, fn)` and Node `assert` pattern as `scripts/test-cycle-tracking.mjs`:

```js
assert.deepEqual(
  availableDumbbellLoads(normalizeTrainingProfile({ equipment: { dumbbellKg: [3, '2', 3, 11, -1] } })),
  [2, 3],
);
assert.deepEqual(recommendNextLoad({
  availableLoads: [2, 3, 4],
  previousLog: { loadKg: 3, feedback: 'too_easy', sets: [{ plannedReps: 8, completedReps: 8 }, { plannedReps: 8, completedReps: 8 }] },
  todayMode: 'normal',
}), { loadKg: 4, action: 'increase', reason: '上次完成稳定且太轻松' });
assert.equal(recommendNextLoad({
  availableLoads: [2, 3, 4],
  previousLog: { loadKg: 3, feedback: 'uncomfortable', sets: [{ plannedReps: 8, completedReps: 5 }] },
  todayMode: 'normal',
}).action, 'decrease');
assert.equal(recommendNextLoad({ availableLoads: [2, 3], previousLog: null, todayMode: 'suggest_rest' }).action, 'stop');
assert.equal(buildCakeTrendSummary({
  bodyTrendHistory: [{ date: '2026-07-01', weightKg: 60 }, { date: '2026-07-08', weightKg: 59.6 }],
  completedWorkouts: 2, foodHabitDays: 3,
}).label, '稳稳变好的第 1 周');
```

Add invalid date/weight, unknown feedback, duplicate load, 121-character note, and fourth-history-entry cases.

- [ ] **Step 2: Verify red**

Run: `node scripts/test-adaptive-training.mjs`

Expected: FAIL with missing `trainingProfile.js`.

- [ ] **Step 3: Implement `trainingProfile.js`**

Export:

```js
export const TRAINING_GOALS = ['habit', 'shape', 'fat_loss_food'];
export const EXPERIENCE_LEVELS = ['new', 'occasional', 'consistent'];
export const AVOID_MOVEMENTS = ['squat', 'hinge', 'overhead_press', 'jump', 'stand_after_sitting'];
export const DUMBBELL_PRESETS = [0.5, 1, 1.5, 2, 3, 4, 5, 7.5, 10];
```

Return complete safe defaults; dedupe/sort positive loads up to 100 kg; cap free text at 120 characters; keep only known goals, experience and movement limits. Cake summary returns `{ label, layers, explanation }`, with this exact explanation: `这是你和自己的趋势对比，不是体脂测试，也不会决定你今天该练多重。`.

- [ ] **Step 4: Implement `exerciseHistory.js`**

Normalize logs to valid date, feedback (`too_easy`, `just_right`, `somewhat_hard`, `uncomfortable`), optional positive `loadKg`, maximum five 1–30-rep sets and a 120-character note. Implement:

```js
if (todayMode === 'suggest_rest') return { loadKg: null, action: 'stop', reason: '今天先不加重量' };
if (availableLoads.length === 0) return { loadKg: null, action: 'bodyweight', reason: '先用徒手版本试一组' };
if (!previousLog) return { loadKg: availableLoads[0], action: 'start', reason: '先从最小可用档位试一组' };
```

Increase only after fully completed `too_easy`; keep for `just_right`; keep/decrease for `somewhat_hard`; decrease to the previous available load for `uncomfortable`; never return a non-owned load.

- [ ] **Step 5: Verify green and commit**

Add `"test:adaptive": "node scripts/test-adaptive-training.mjs"` to `package.json`.

Run: `npm run test:adaptive`

Expected: all domain tests pass.

```bash
git add package.json scripts/test-adaptive-training.mjs src/lib/trainingProfile.js src/lib/exerciseHistory.js
git commit -m "feat: add adaptive training domain rules"
```

---

### Task 2: 组合动作、替代动作和盘餐法

**Files:**

- Create: `src/features/today/adaptiveWorkout.js`
- Modify: `scripts/test-adaptive-training.mjs`
- Modify: `src/App.jsx`
- Modify: `src/features/calendar/PlanCalendar.jsx`
- Modify: `src/features/today/TodayPage.jsx`

**Interface:**

```js
buildAdaptiveWorkout({ basePlan, state, trainingProfile, exerciseHistory, cycleAdjustment })
// => { mode, movements, mealGuide, safetyNotice }
```

Each movement supplies `id`, `name`, `replacement`, `equipmentLabel`, `sets`, `targetReps`, `suggestedLoad`, `why`, `stopHint`.

- [ ] **Step 1: Write failing workout tests**

Append:

```js
const workout = buildAdaptiveWorkout({
  basePlan: buildPlan('30分钟', '白班', '家里'),
  state: { time: '30分钟', status: '白班', condition: '家里' },
  trainingProfile: normalizeTrainingProfile({
    goal: 'shape', experience: 'new', equipment: { bodyweight: true, dumbbellKg: [2, 3] },
    avoidMovements: ['squat'], safetyFlag: 'none',
  }), exerciseHistory: [], cycleAdjustment: { level: 'normal' },
});
assert.equal(workout.movements.some((item) => item.id === 'goblet_squat'), false);
assert.equal(workout.movements.some((item) => item.replacement?.includes('臀桥')), true);
assert.equal(workout.movements[0].suggestedLoad.loadKg, 2);
```

Assert safety flag returns `suggest_rest`, `fat_loss_food` has no calorie field, and light/recovery movements have at most two sets.

- [ ] **Step 2: Verify red**

Run: `npm run test:adaptive`

Expected: `buildAdaptiveWorkout` missing.

- [ ] **Step 3: Implement pure composer**

Create a small catalog for squat, bridge/hinge, horizontal pull, horizontal push, core, walk/mobility. Resolve in this exact order: safety flag/`suggest_rest`, cycle mode, avoided movement, owned equipment, goal, prior log. Use only these load strings:

```js
const loadCopy = {
  start: '先从最小可用档位试一组', increase: '上次很稳，今天可以试下一档',
  keep: '先继续用上次这个重量', decrease: '今天先换轻一点，动作稳更重要',
  bodyweight: '先用徒手版本试一组', stop: '今天先不加重量，做舒缓活动或休息',
};
```

- [ ] **Step 4: Lift state in App**

Add in `App.jsx`:

```js
const [trainingProfile, setTrainingProfile] = useLocalStorageState('training-profile', {});
const [bodyTrendHistory, setBodyTrendHistory] = useLocalStorageState('body-trend-history', []);
const [exerciseHistory, setExerciseHistory] = useLocalStorageState('exercise-session-history', []);
const [cycleLogs, setCycleLogs] = useLocalStorageState('cycle-logs', []);
```

Move the existing `cycle-logs` local-storage ownership from `PlanCalendar` to `App`; pass `cycleLogs` and `setCycleLogs` into `PlanCalendar` so an in-session calendar update immediately changes Today's advice. In `App`, normalize the logs, find `localDateKey()` and pass `getCycleTrainingAdjustment(todayCycleLog)` into the composer. A missing log must resolve to the existing `normal` adjustment. Keep `cycle-settings` inside `PlanCalendar`, and do not add any health data to generic snapshots.

Use `useMemo` to compose the adaptive workout and pass it plus history/setter to Today. Keep existing `buildPlan` unchanged so exact legacy assertions survive.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run test:adaptive
npm run test:app-logic
```

Expected: adaptive and old exact plan tests pass.

```bash
git add src/features/today/adaptiveWorkout.js src/App.jsx src/features/calendar/PlanCalendar.jsx src/features/today/TodayPage.jsx scripts/test-adaptive-training.mjs
git commit -m "feat: compose adaptive beginner workouts"
```

---

### Task 3: 分步训练资料设置与本机隐私

**Files:**

- Create: `src/features/profile/TrainingProfileSheet.jsx`
- Modify: `src/features/profile/ProfilePage.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles/profile.css`
- Modify: `src/lib/syncSnapshot.js`
- Modify: `scripts/test-adaptive-training.mjs`
- Modify: `scripts/test-app-smoke.mjs`

**Interface:**

```jsx
<TrainingProfileSheet profile={profile} bodyTrendHistory={history}
  onSaveProfile={setTrainingProfile} onSaveWeight={setBodyTrendHistory} onClose={close} />
```

- [ ] **Step 1: Write failing privacy and UI tests**

In `test-adaptive-training.mjs`, mock localStorage and prove `collectLocalSnapshot()` omits `training-profile`, `body-trend-history`, and `exercise-session-history`.

Add smoke flow:

```js
await page.getByText('训练偏好', { exact: true }).click();
await expectVisible(page.getByRole('dialog', { name: '训练资料设置', exact: true }), 'Training profile sheet');
await page.getByRole('button', { name: '建立习惯', exact: true }).click();
await page.getByRole('button', { name: '从没练过', exact: true }).click();
await page.getByRole('button', { name: '2kg', exact: true }).click();
await page.getByRole('button', { name: '保存训练资料', exact: true }).click();
await page.waitForFunction(() => JSON.parse(localStorage.getItem('training-profile') || '{}').goal === 'habit');
```

- [ ] **Step 2: Verify red**

Run: `npm run test:smoke`

Expected: training profile dialog absent.

- [ ] **Step 3: Implement `TrainingProfileSheet`**

Reuse `ModalPortal` and Profile setting patterns. Render headings in order: `你想先改善什么？`, `你的身高和本周体重`, `你练过吗？`, `你在哪里练、手边有什么？`, `有什么动作需要避开？`, `安全确认`, and (only for `fat_loss_food`) `减脂饮食习惯`.

Use labelled numeric inputs `身高（cm）` and `本周体重（kg）`; multi-select bodyweight, bands, kettlebell, gym machines, preset/custom dumbbell weights and adjustable range. Map the five visible avoid actions to `AVOID_MOVEMENTS`. Use exact safety choices `没有需要暂停训练的情况` and `近期受伤、医生限制或需要先咨询专业人士`. Footer displays `身体资料默认仅保存在这台设备。`; save button says `保存训练资料`.

- [ ] **Step 4: Integrate and verify**

Profile consumes the lifted App states and saves normalized values plus one weekly body-trend entry. Do not add new keys to `SNAPSHOT_KEYS`; only add a restore denylist if the privacy test shows a legacy snapshot can restore them. Add a scrollable sheet, 44px targets, chosen-weight chips and an amber non-diagnostic safety callout in `profile.css`.

Run:

```bash
npm run test:adaptive
npm run test:smoke
```

Expected: profile persists locally; generic snapshots omit body data.

```bash
git add src/features/profile/TrainingProfileSheet.jsx src/features/profile/ProfilePage.jsx src/App.jsx src/styles/profile.css src/lib/syncSnapshot.js scripts/test-adaptive-training.mjs scripts/test-app-smoke.mjs
git commit -m "feat: collect beginner training profiles locally"
```

---

### Task 4: 动作实际重量、组次、感受与便签

**Files:**

- Create: `src/features/today/AdaptiveWorkoutCard.jsx`
- Modify: `src/features/today/TodayPage.jsx`
- Modify: `src/styles/base.css`
- Modify: `src/styles/responsive.css`
- Modify: `scripts/test-app-smoke.mjs`

**Interface:**

```jsx
<AdaptiveWorkoutCard workout={adaptiveWorkout} profile={trainingProfile}
  exerciseHistory={exerciseHistory} onSaveLog={setExerciseHistory} />
```

- [ ] **Step 1: Write failing interaction test**

Append after Today confirmation:

```js
await expectVisible(page.getByText('今天做什么', { exact: true }), 'Adaptive workout card');
await page.getByRole('button', { name: '记录第 1 个动作', exact: true }).click();
await page.getByRole('button', { name: '2kg', exact: true }).click();
await page.getByRole('button', { name: '第 1 组完成 8 次', exact: true }).click();
await page.getByRole('button', { name: '刚刚好', exact: true }).click();
await page.getByPlaceholder('留一句给下次的自己（选填）').fill('动作慢一点更稳');
await page.getByRole('button', { name: '保存这次动作', exact: true }).click();
await page.waitForFunction(() => JSON.parse(localStorage.getItem('exercise-session-history') || '[]').some((item) => item.loadKg === 2 && item.note === '动作慢一点更稳'));
```

- [ ] **Step 2: Verify red**

Run: `npm run test:smoke`

Expected: `今天做什么` absent.

- [ ] **Step 3: Implement `AdaptiveWorkoutCard`**

For each movement render previous result, today suggestion/reason, owned weight buttons or `徒手`, all planned set completions, four feedback buttons, note input and save. Save is disabled until selected load/bodyweight, all sets and feedback. Persist via `upsertExerciseLog` without replacing another action’s history. In `suggest_rest`, render safety notice without weights. For a substitution display `如果不舒服，换成：{replacement}` only.

- [ ] **Step 4: Integrate, style, verify**

Render under existing generic training ResultCard only after plan confirmation. If profile incomplete, show `补充器械和经验后，我可以告诉你先拿多重。`. Add 44px controls, 2–3 column weight chips and a three-row history in `base.css`/`responsive.css`.

Run:

```bash
npm run test:adaptive
npm run test:smoke
```

Expected: actual load, set, feedback and note persist without breaking unprofiled Today flow.

```bash
git add src/features/today/AdaptiveWorkoutCard.jsx src/features/today/TodayPage.jsx src/styles/base.css src/styles/responsive.css scripts/test-app-smoke.mjs
git commit -m "feat: record beginner workout loads and notes"
```

---

### Task 5: 中性每周趋势蛋糕和发布验证

**Files:**

- Create: `src/features/profile/BodyTrendCard.jsx`
- Modify: `src/features/profile/ProfilePage.jsx`
- Modify: `src/styles/profile.css`
- Modify: `scripts/test-adaptive-training.mjs`
- Modify: `scripts/test-app-smoke.mjs`

- [ ] **Step 1: Write failing trend tests**

Assert three weekly entries produce sorted history and nonzero `layers`. Add smoke flow:

```js
await page.getByText('我的身体趋势', { exact: true }).click();
await page.getByLabel('本周体重（kg）').fill('59.6');
await page.getByRole('button', { name: '记录本周体重', exact: true }).click();
await expectVisible(page.getByText('这是你和自己的趋势对比，不是体脂测试，也不会决定你今天该练多重。', { exact: true }), 'Cake trend explanation');
```

- [ ] **Step 2: Verify red**

Run: `npm run test:adaptive`

Expected: `BodyTrendCard` missing.

- [ ] **Step 3: Implement and verify**

Render `我的身体趋势`, accessible `?`, decorative cake driven only by `CakeTrendSummary.layers`, habit chips, weekly input and `记录本周体重`. Upsert one point per local calendar week. The question mark shows the exact test sentence. Never render a size category, body-fat range, calorie value or load recommendation.

 - [ ] **Step 4: Commit**

```bash
git add src/features/profile/BodyTrendCard.jsx src/features/profile/ProfilePage.jsx src/styles/profile.css scripts/test-adaptive-training.mjs scripts/test-app-smoke.mjs
git commit -m "feat: add private body trend cake"
```

- [ ] **Step 5: Audit and release**

Run:

```bash
npm run test:app-logic
npm run test:cycle
npm run test:adaptive
npm run test:smoke
npm run check:maintenance-diff
npm run build
```

Expected: all commands exit 0.

Then run:

```bash
rg -n "training-profile|body-trend-history|exercise-session-history" src/lib/syncSnapshot.js src
git status --short
git log --oneline -6
git push origin main
```

Expected: body keys absent from `SNAPSHOT_KEYS`; only intended source/test/style/docs commits are pushed; exclude `.env.local`, `.superpowers/`, `NEXT_SESSION_2026-07-12.md`, screenshots and credentials.
