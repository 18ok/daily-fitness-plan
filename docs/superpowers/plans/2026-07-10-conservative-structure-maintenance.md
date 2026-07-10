# Conservative Structure Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the oversized application and stylesheet into feature-focused modules without changing UI, behavior, persistence, or Supabase integration semantics.

**Architecture:** Keep `App.jsx` as the composition root and preserve current state ownership. Move page implementations into `src/features`, shared presentational controls into `src/components`, pure calculations into feature-local JavaScript modules, and CSS into ordered contiguous slices imported by one stylesheet index.

**Tech Stack:** React 19, Vite 6, JavaScript/JSX, Node.js built-in assertions, Playwright, Supabase JS 2.

## Global Constraints

- Preserve all visible text, DOM hierarchy, CSS class names, tab behavior, sheet behavior, and scrolling behavior.
- Preserve every localStorage key, value shape, default, and persistence timing.
- Preserve Supabase tables, authentication method, synchronization priority, and call timing.
- Do not add routing, React Context, a state library, TypeScript, features, or visual changes.
- Move CSS declarations without editing or reordering them.
- Record behavior-changing defects in the deferred audit instead of fixing them.
- Run a production build after every extraction task.

## Target File Map

- Create `src/main.jsx`: React DOM startup and global stylesheet import.
- Modify `src/App.jsx`: application state and feature composition only.
- Create `src/components/Header.jsx`: branded header and calendar toggle.
- Create `src/components/BottomNavigation.jsx`: tab definitions and navigation buttons.
- Create `src/components/common/Sticker.jsx`: shared sticker image primitive.
- Create `src/components/common/SelectionControls.jsx`: `OptionChip` and `ChoiceGroup`.
- Create `src/components/common/ResultCard.jsx`: shared result card.
- Create `src/features/today/planBuilder.js`: plan library, condition mapping, and `buildPlan`.
- Create `src/features/today/TodayPage.jsx`: today's plan UI and persistence.
- Create `src/features/record/recordFeedback.js`: companion copy and record feedback calculations.
- Create `src/features/record/RecordPage.jsx`: record UI and persistence.
- Create `src/features/library/TemplateDetailSheet.jsx`: template details UI.
- Create `src/features/library/LibraryPage.jsx`: plan library UI.
- Create `src/features/stickers/StickersPage.jsx`: sticker UI and favorites.
- Create `src/features/profile/ProfilePage.jsx`: profile, preferences, authentication, and cloud synchronization.
- Move `src/components/PlanCalendar.jsx` to `src/features/calendar/PlanCalendar.jsx`.
- Create `src/styles/index.css`: ordered stylesheet imports.
- Create `src/styles/base.css`, `record.css`, `library.css`, `stickers.css`, `profile.css`, `calendar.css`, and `responsive.css`: contiguous original CSS slices.
- Create `scripts/test-app-logic.mjs`: plan and record calculation regression tests.
- Create `scripts/test-app-smoke.mjs`: deterministic browser smoke checks.
- Create `docs/maintenance/2026-07-10-structure-audit.md`: deferred risk register and later page-upgrade order.
- Modify `index.html`, `package.json`, and `.gitignore` for the entry point and test commands.

---

### Task 1: Capture The Pre-Refactor Baseline

**Files:**
- Modify: `.gitignore`
- Create locally: `artifacts/structure-baseline-mobile.png`
- Create locally: `artifacts/structure-baseline-desktop.png`

**Interfaces:**
- Consumes: the current production application.
- Produces: baseline build/test results and ignored reference screenshots for final comparison.

- [ ] **Step 1: Ignore local verification artifacts**

Add this exact entry to `.gitignore`:

```gitignore
# Local browser verification output
/artifacts/
```

- [ ] **Step 2: Re-run the existing baseline checks**

Run:

```powershell
npm run build
npm run test:cycle
```

Expected: Vite exits `0`; all 12 cycle-tracking checks print `ok` and the final success line.

- [ ] **Step 3: Capture deterministic screenshots**

Start the dev server with `npm run dev`. With a clean browser context, capture `/` at `390x844` and `1280x900` after animations settle. Save the files under `artifacts/` using the names above.

Expected: both screenshots show the current Today page; browser console has no uncaught errors.

- [ ] **Step 4: Commit the baseline harness change**

```powershell
git add .gitignore
git commit -m "chore: ignore local verification artifacts"
```

### Task 2: Characterize And Extract Pure App Logic

**Files:**
- Create: `src/features/today/planBuilder.js`
- Create: `src/features/record/recordFeedback.js`
- Create: `scripts/test-app-logic.mjs`
- Modify: `src/App.jsx`
- Modify: `package.json`

**Interfaces:**
- Produces: `buildPlan(time, status, condition) -> Plan`.
- Produces: `recordCompanionText(status) -> string`.
- Produces: `buildRecordFeedback(checks, energy, appetite) -> { title, body, badge }`.
- Consumers: `TodayPage`, `RecordPage`, and the regression test script.

- [ ] **Step 1: Write the failing characterization tests**

Create `scripts/test-app-logic.mjs` with representative exact outputs:

```js
import assert from 'node:assert/strict';
import { buildPlan } from '../src/features/today/planBuilder.js';
import { buildRecordFeedback, recordCompanionText } from '../src/features/record/recordFeedback.js';

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

run('night-shift gym plan preserves recovery output', () => {
  assert.deepEqual(buildPlan('30分钟', '夜班后', '健身房'), {
    trainingTitle: '30分钟 轻恢复',
    training: '轻力量 + 核心激活',
    trainingDetail: '热身5分钟 + 力量20分钟 + 拉伸5分钟',
    foodTitle: '夜班后小份恢复餐',
    food: '高蛋白 + 易消化 + 少油甜',
    minimum: ['训练≥20分钟', '蛋白质≥1掌心', '喝水≥1.5L'],
    avoid: ['空腹高强度', '久坐不动', '暴饮暴食'],
    note: '夜班后先恢复，不用补偿式加练。',
  });
});

run('tired store plan preserves downgrade output', () => {
  const plan = buildPlan('15分钟', '很累', '速食便利店');
  assert.equal(plan.trainingTitle, '15分钟 降级版');
  assert.equal(plan.food, '豆浆 / 鸡蛋 / 饭团 / 香蕉');
  assert.deepEqual(plan.minimum, ['走路10分钟', '吃到蛋白质', '早点休息']);
});

run('record companion copy preserves status branches', () => {
  assert.equal(recordCompanionText('夜班后'), '今天不用完美，夜班后慢慢照顾自己也很好。');
  assert.equal(recordCompanionText('休息日'), '休息日也可以轻轻记录一下，保持节奏就很可爱。');
});

run('record feedback prioritizes tired energy', () => {
  assert.deepEqual(buildRecordFeedback(['训练完成'], '很累', '正常吃了'), {
    title: '今天适合先恢复',
    body: '今天先恢复也很好，不需要补偿式加练。能把身体感受留下来，就已经在认真照顾自己了。',
    badge: '记录了 1 个小照顾',
  });
});

run('record feedback preserves stable completion output', () => {
  const result = buildRecordFeedback(['训练完成', '吃饭完成'], '还可以', '正常吃了');
  assert.equal(result.title, '今天已经很稳啦');
  assert.equal(result.badge, '小小成就 +1');
});

console.log('\nAll app logic tests passed.');
```

Add to `package.json`:

```json
"test:app-logic": "node scripts/test-app-logic.mjs"
```

- [ ] **Step 2: Run the tests and confirm the missing modules fail**

Run: `npm run test:app-logic`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `planBuilder.js`.

- [ ] **Step 3: Move the existing functions without editing their bodies**

Move `planLibrary`, `conditionKey`, and `buildPlan` into `planBuilder.js`, exporting only `buildPlan`. Move `recordCompanionText` and `buildRecordFeedback` into `recordFeedback.js`, exporting both functions. Replace their definitions in `App.jsx` with:

```js
import { buildPlan } from './features/today/planBuilder';
import { buildRecordFeedback, recordCompanionText } from './features/record/recordFeedback';
```

- [ ] **Step 4: Verify logic and build**

Run:

```powershell
npm run test:app-logic
npm run test:cycle
npm run build
```

Expected: all commands exit `0`; app-logic prints five `ok` lines.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json scripts/test-app-logic.mjs src/App.jsx src/features/today/planBuilder.js src/features/record/recordFeedback.js
git commit -m "refactor: extract app calculation logic"
```

### Task 3: Extract Shared Components And Application Chrome

**Files:**
- Create: `src/components/common/Sticker.jsx`
- Create: `src/components/common/SelectionControls.jsx`
- Create: `src/components/common/ResultCard.jsx`
- Create: `src/components/Header.jsx`
- Create: `src/components/BottomNavigation.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- `Sticker({ src, alt, className = '' })` renders the unchanged non-draggable image.
- `OptionChip({ active, icon, label, onClick })` and `ChoiceGroup({ title, children })` preserve selection markup.
- `ResultCard({ tone, icon, title, subtitle, detail, chips, sticker, alt })` preserves result markup.
- `Header({ calendarOpen, onCalendarToggle })` preserves header behavior.
- `BottomNavigation({ activeTab, onTabChange })` owns the unchanged tab metadata and renders the nav.

- [ ] **Step 1: Create component files by moving the existing JSX verbatim**

Each file exports its named component. `BottomNavigation` uses this exact public shape:

```jsx
export function BottomNavigation({ activeTab, onTabChange }) {
  return (
    <nav className="bottom-nav" aria-label="底部导航">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button className={activeTab === id ? 'is-active' : ''} key={id} onClick={() => onTabChange(id)} type="button">
          <Icon size={21} strokeWidth={activeTab === id ? 2.6 : 2.2} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Replace local definitions in `App.jsx` with imports**

Use these component calls without changing props:

```jsx
<Header calendarOpen={calendarOpen} onCalendarToggle={() => setCalendarOpen((open) => !open)} />
{!calendarOpen && <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />}
```

- [ ] **Step 3: Verify**

Run: `npm run build`

Expected: Vite exits `0` with no missing imports or JSX errors.

- [ ] **Step 4: Commit**

```powershell
git add src/App.jsx src/components
git commit -m "refactor: extract shared application components"
```

### Task 4: Extract Today And Record Features

**Files:**
- Create: `src/features/today/TodayPage.jsx`
- Create: `src/features/record/RecordPage.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- `TodayPage({ state, setState, plan })` retains `daily-plan-history` ownership.
- `RecordPage({ state })` retains `record-checks`, `record-energy`, `record-appetite`, and `care-history` ownership.

- [ ] **Step 1: Move `TodayPage` and its option metadata verbatim**

Import `buildPlan` nowhere in this component; the computed `plan` remains an input. Preserve this state update contract:

```js
const update = (key, value) => setState((current) => ({ ...current, [key]: value }));
```

- [ ] **Step 2: Move `RecordPage` verbatim**

Import `buildRecordFeedback` and `recordCompanionText` from `./recordFeedback`, and preserve all localStorage keys and save behavior.

- [ ] **Step 3: Import both pages in `App.jsx` and remove their old definitions**

```js
import { TodayPage } from './features/today/TodayPage';
import { RecordPage } from './features/record/RecordPage';
```

- [ ] **Step 4: Verify**

Run:

```powershell
npm run test:app-logic
npm run build
```

Expected: both commands exit `0`.

- [ ] **Step 5: Commit**

```powershell
git add src/App.jsx src/features/today/TodayPage.jsx src/features/record/RecordPage.jsx
git commit -m "refactor: isolate today and record features"
```

### Task 5: Extract Library And Sticker Features

**Files:**
- Create: `src/features/library/TemplateDetailSheet.jsx`
- Create: `src/features/library/LibraryPage.jsx`
- Create: `src/features/stickers/StickersPage.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- `LibraryPage({ state, setState, setActiveTab })` retains template filtering, apply state, and tab transition.
- `TemplateDetailSheet({ template, onClose, onApply })` retains backdrop event handling.
- `StickersPage({ state })` retains `sticker-favorites` ownership and recommendation state.

- [ ] **Step 1: Move template details and its `PlanStepCard` helper verbatim**

Keep the helper private to `TemplateDetailSheet.jsx`; export only:

```js
export function TemplateDetailSheet({ template, onClose, onApply }) { /* unchanged JSX */ }
```

- [ ] **Step 2: Move `LibraryPage` and `StickersPage` verbatim**

Keep feature-local category and selected-item state inside each component. Use the shared `Sticker` import in both features.

- [ ] **Step 3: Replace definitions in `App.jsx` with imports**

```js
import { LibraryPage } from './features/library/LibraryPage';
import { StickersPage } from './features/stickers/StickersPage';
```

- [ ] **Step 4: Verify and commit**

Run `npm run build`; expected exit code `0`.

```powershell
git add src/App.jsx src/features/library src/features/stickers
git commit -m "refactor: isolate library and sticker features"
```

### Task 6: Extract Profile, Calendar, And Startup

**Files:**
- Create: `src/features/profile/ProfilePage.jsx`
- Move: `src/components/PlanCalendar.jsx` to `src/features/calendar/PlanCalendar.jsx`
- Create: `src/main.jsx`
- Modify: `src/App.jsx`
- Modify: `index.html`

**Interfaces:**
- `ProfilePage()` retains all profile localStorage state and all Supabase effects and handlers.
- `PlanCalendar()` retains calendar, cycle, and remote repository behavior.
- `App()` becomes the default export and owns only composition state.

- [ ] **Step 1: Move profile code verbatim**

Move `SettingOption`, `ProfileSheetActions`, profile option constants, and `ProfilePage` together. Do not extract authentication or synchronization hooks in this phase.

- [ ] **Step 2: Move the calendar and adjust only relative paths**

After `git mv`, all imports currently beginning with `../hooks` or `../lib` become `../../hooks` or `../../lib`. The component's code and exports remain unchanged.

- [ ] **Step 3: Reduce `App.jsx` to composition and export it**

The final file imports React state/memo hooks, `useLocalStorageState`, feature pages, header/navigation, and `buildPlan`. It ends with:

```js
export default App;
```

- [ ] **Step 4: Create the React startup entry**

Create `src/main.jsx`:

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

createRoot(document.getElementById('root')).render(<App />);
```

Change the script in `index.html` to:

```html
<script type="module" src="/src/main.jsx"></script>
```

- [ ] **Step 5: Verify and commit**

Run `npm run test:app-logic`, `npm run test:cycle`, and `npm run build`; all must exit `0`.

```powershell
git add index.html src/App.jsx src/main.jsx src/features/profile src/features/calendar src/components/PlanCalendar.jsx
git commit -m "refactor: isolate profile calendar and startup"
```

### Task 7: Split CSS Without Changing The Cascade

**Files:**
- Create: `src/styles/index.css`
- Create: `src/styles/base.css`
- Create: `src/styles/record.css`
- Create: `src/styles/library.css`
- Create: `src/styles/stickers.css`
- Create: `src/styles/profile.css`
- Create: `src/styles/calendar.css`
- Create: `src/styles/responsive.css`
- Delete: `src/styles.css`

**Interfaces:**
- `src/main.jsx` imports only `src/styles/index.css`.
- `index.css` imports slices in their original byte order.

- [ ] **Step 1: Split at exact original selector boundaries**

Create the temporary `scripts/split-styles.mjs` below. It selects later repeated markers only after the preceding boundary and proves that concatenating all slices reproduces the original source exactly:

```js
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

function findBoundary(marker, after = 0) {
  const index = source.indexOf(`\n${marker}`, after);
  assert.notEqual(index, -1, `Missing CSS boundary: ${marker}`);
  return index + 1;
}

const record = findBoundary('.record-grid');
const library = findBoundary('.sub-title-row', record);
const stickers = findBoundary('.sticker-grid', library);
const profile = findBoundary('.profile-card', stickers);
const calendar = findBoundary('.calendar-page', profile);
const responsive = findBoundary('@media (max-width: 520px)', calendar);

const slices = {
  'base.css': source.slice(0, record),
  'record.css': source.slice(record, library),
  'library.css': source.slice(library, stickers),
  'stickers.css': source.slice(stickers, profile),
  'profile.css': source.slice(profile, calendar),
  'calendar.css': source.slice(calendar, responsive),
  'responsive.css': source.slice(responsive),
};

assert.equal(Object.values(slices).join(''), source);
await mkdir(new URL('../src/styles/', import.meta.url), { recursive: true });
await Promise.all(
  Object.entries(slices).map(([name, content]) =>
    writeFile(new URL(`../src/styles/${name}`, import.meta.url), content, 'utf8')),
);
console.log('CSS slices preserve the original source exactly.');
```

Run `node scripts/split-styles.mjs`. Expected: `CSS slices preserve the original source exactly.` Then delete `src/styles.css` and the temporary script; neither deletion occurs before the equality assertion passes.

- [ ] **Step 2: Create the ordered index**

```css
@import './base.css';
@import './record.css';
@import './library.css';
@import './stickers.css';
@import './profile.css';
@import './calendar.css';
@import './responsive.css';
```

- [ ] **Step 3: Verify the build and visual baseline**

Run `npm run build`. Re-capture the same mobile and desktop states used in Task 1 and compare them with the baseline screenshots. Expected: no visible difference.

- [ ] **Step 4: Commit**

```powershell
git add src/main.jsx src/styles src/styles.css
git commit -m "refactor: split styles by feature"
```

### Task 8: Add Browser Smoke Coverage And Maintenance Audit

**Files:**
- Create: `scripts/test-app-smoke.mjs`
- Create: `docs/maintenance/2026-07-10-structure-audit.md`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run test:smoke`, which starts an isolated Vite server, checks main UI flows, and exits nonzero on page or console errors.

- [ ] **Step 1: Add the complete smoke script**

Create `scripts/test-app-smoke.mjs`:

```js
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const host = '127.0.0.1';
const port = 4176;
const origin = `http://${host}:${port}`;
const expectedPages = [
  ['今日计划', '.selector-panel'],
  ['记录', '.record-page'],
  ['计划库', '.library-page'],
  ['能量贴纸', '.sticker-page'],
  ['我的', '.profile-page'],
];

const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  server: { host, port, strictPort: true },
});
let browser;

try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(origin, { waitUntil: 'networkidle' });

  for (const [label, selector] of expectedPages) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.locator(selector).waitFor({ state: 'visible' });
    console.log(`ok - ${label}`);
  }

  await page.getByRole('button', { name: '计划日历', exact: true }).click();
  await page.locator('.calendar-page').waitFor({ state: 'visible' });
  console.log('ok - 计划日历');
  assert.deepEqual(errors, [], `Browser errors:\n${errors.join('\n')}`);
  await context.close();
  console.log('\nAll app smoke checks passed.');
} finally {
  if (browser) await browser.close();
  await server.close();
}
```

Expected behavior: the in-process Vite server and Chromium browser always close in `finally`, including on assertion failure.

- [ ] **Step 2: Add the package command**

```json
"test:smoke": "node scripts/test-app-smoke.mjs"
```

- [ ] **Step 3: Write the deferred audit with known risks**

The audit must record these concrete deferred items:

- `ProfilePage.jsx` remains intentionally large because authentication and synchronization extraction could change effect timing.
- `PlanCalendar.jsx` still combines presentation, editor state, local persistence, and remote synchronization.
- The production JavaScript bundle remains approximately 487 KB before gzip and is not optimized in this phase.
- Several sticker assets remain above 100 KB and are not converted or compressed in this phase.
- Browser smoke does not validate a live Supabase account or destructive cloud restore.
- Page redesign work follows this order: Today, Record, Library, Stickers, Profile, Calendar.

- [ ] **Step 4: Run the complete verification set**

Run:

```powershell
npm run test:app-logic
npm run test:cycle
npm run test:smoke
npm run build
git diff --check
```

Expected: all commands exit `0`; smoke reports every page and calendar check as passed; Git reports no whitespace errors.

- [ ] **Step 5: Review scope invariants**

Compare the localStorage string literals before and after using Git history and confirm the same keys remain. Confirm `supabase/` has no diff. Confirm the final screenshots have no visible changes from Task 1.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json scripts/test-app-smoke.mjs docs/maintenance/2026-07-10-structure-audit.md
git commit -m "test: add app structure regression coverage"
```

## Final Review Gate

- [ ] Confirm `App.jsx` contains composition only and no page implementation.
- [ ] Confirm dependency direction is `App -> features -> components/hooks/lib/data`.
- [ ] Confirm build, cycle tests, app-logic tests, and browser smoke all pass.
- [ ] Confirm no localStorage keys or Supabase files changed.
- [ ] Confirm before-and-after mobile and desktop screenshots are visually identical.
- [ ] Confirm the maintenance audit contains all deferred risks and the approved upgrade order.
