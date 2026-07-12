# 经期记录与训练调整闭环：实施计划

> **For implementation:** this plan is executed inline in the current workspace. Do not delegate this task to subagents under the workspace policy.

**Goal:** 将“计划日历”的单日经期标签升级为“记录今天 → 说明今天训练如何调整”的 30 秒闭环；支持连续经期事件、补录/编辑/删除、保守的预测区间及明确的健康数据云同步同意。

**Architecture:** 延展现有每日期录 `cycle_logs`，以 `periodStatus`（开始/进行中/结束）表达连续事件，而不引入第二张事件表。周期推测沿用本地、可解释的历史开始日中位数与日期范围；训练建议由纯函数根据疼痛、精力、睡眠与红旗信号给出，UI 只渲染结果。浏览器本地记录始终可用；仅在用户明确同意后读取或写入 Supabase。

**Tech Stack:** React 18 + Vite、localStorage、Supabase Postgres/RLS、Node `assert`、Playwright。

**Design source:** `docs/superpowers/specs/2026-07-12-cycle-training-loop-design.md`。

---

## Task 1: 先锁定扩展日志与保守训练规则的纯函数行为

**Files:**

- Modify: `scripts/test-cycle-tracking.mjs`
- Modify: `src/lib/cycleTracking.js`
- Create: `src/lib/cycleTrainingAdjustment.js`

**Step 1: 写会失败的测试**

在 `scripts/test-cycle-tracking.mjs` 增加以下断言组，暂不修改实现：

```js
assert.deepEqual(
  derivePeriodStarts([
    { date: '2026-06-01', periodStatus: 'started' },
    { date: '2026-06-02', periodStatus: 'ongoing', bleedingLevel: 'medium' },
    { date: '2026-06-03', periodStatus: 'ended' },
    { date: '2026-06-29', bleedingLevel: 'heavy' },
  ]),
  ['2026-06-01', '2026-06-29'],
);

const normalizedExtended = normalizeCycleLogs([{
  date: '2026-06-01', periodStatus: 'started', painLevel: 6,
  energyLevel: 3, sleepQuality: 'poor', redFlags: ['dizziness'],
}])[0];
assert.equal(normalizedExtended.periodStatus, 'started');
assert.equal(normalizedExtended.painLevel, 6);
assert.equal(normalizedExtended.energyLevel, 3);
assert.equal(normalizedExtended.sleepQuality, 'poor');
assert.deepEqual(normalizedExtended.redFlags, ['dizziness']);
assert.equal(typeof normalizedExtended.updatedAt, 'string');

assert.equal(getCycleTrainingAdjustment({ painLevel: 7 }).level, 'suggest_rest');
assert.equal(getCycleTrainingAdjustment({ redFlags: ['abnormal_bleeding'] }).level, 'suggest_rest');
assert.equal(getCycleTrainingAdjustment({ painLevel: 4 }).level, 'recovery');
assert.equal(getCycleTrainingAdjustment({ energyLevel: 5 }).level, 'light');
assert.equal(getCycleTrainingAdjustment({ energyLevel: 8, sleepQuality: 'good' }).level, 'normal');
```

再为以下边界加用例：无效状态/0–10 外数值/非法睡眠枚举会归一为 `null` 或空数组；旧日志维持原样；仅点滴不会成为后备周期开始日。

**Step 2: 运行并确认失败**

Run: `node scripts/test-cycle-tracking.mjs`

Expected: 因新导入的训练规则函数或日志字段尚不存在而失败。

**Step 3: 以最小实现通过测试**

在 `src/lib/cycleTracking.js`：

- 增加 `PERIOD_STATUSES = {'started','ongoing','ended'}`、睡眠枚举与 0–10 整数归一函数。
- 将标准日志形状扩为：`periodStatus`、`painLevel`、`energyLevel`、`sleepQuality`、`redFlags`，继续兼容所有旧字段。
- 重写 `derivePeriodStarts`：先保留所有显式 `periodStatus === 'started'`；再只为**不含任一显式状态**的旧式连续出血组使用首日后备推断；合并、去重并按日期升序返回。这样新日志的“进行中/结束”不会误生一个开始日，而历史日志仍可估计。
- 不改变 `calculateCycleSummary` 的中位数、最少两次开始日、日期范围和不提供排卵/易孕结论的边界。

创建 `src/lib/cycleTrainingAdjustment.js`，导出 `getCycleTrainingAdjustment(log)`。其返回稳定的 UI 数据而非医疗判断：

```js
{ level: 'normal' | 'light' | 'recovery' | 'suggest_rest',
  title: string,
  reasons: string[],
  suggestion: string,
  requiresCareNotice: boolean }
```

按优先级实现：红旗信号或疼痛 `>= 7` → `suggest_rest`；疼痛 `4–6`、精力 `0–3` 或睡眠差 → `recovery`；精力 `4–5` 或已有轻度不适 → `light`；其余 → `normal`。文案使用“今天可以考虑/如不适就停止”，不诊断、不将经期阶段作为硬规则。

**Step 4: 运行测试并确认通过**

Run: `node scripts/test-cycle-tracking.mjs`

Expected: 现有日期、预测、增删改测试与新增日志/建议优先级测试均通过。

**Step 5: 提交**

```bash
git add scripts/test-cycle-tracking.mjs src/lib/cycleTracking.js src/lib/cycleTrainingAdjustment.js
git commit -m "feat: model cycle status and training adjustments"
```

---

## Task 2: 扩展 Supabase 数据契约，同时保留 RLS 与旧数据

**Files:**

- Modify: `supabase/cycle_tracking.sql`
- Modify: `src/lib/cycleTrackingRepository.js`
- Modify: `scripts/test-cycle-tracking.mjs`

**Step 1: 写会失败的 repository 映射测试**

将行映射提取并命名导出为仅供测试的 `mapCycleLogRow`、`mapCycleLogPayload`（或等价的纯函数）。在 `scripts/test-cycle-tracking.mjs` 验证：完整新增字段往返不丢失、数据库 `null` 恢复为前端安全默认值、旧的四字段行保持可读。

**Step 2: 运行并确认失败**

Run: `node scripts/test-cycle-tracking.mjs`

Expected: 映射函数未导出，或新增字段未进入 payload/select，测试失败。

**Step 3: 以最小实现通过测试**

在 `supabase/cycle_tracking.sql` 的建表定义后追加可重复执行的迁移（不要重建/清空表）：

```sql
alter table public.cycle_logs
  add column if not exists period_status text,
  add column if not exists pain_level smallint,
  add column if not exists energy_level smallint,
  add column if not exists sleep_quality text,
  add column if not exists red_flags text[] not null default '{}'::text[];

alter table public.cycle_logs
  drop constraint if exists cycle_logs_period_status_check,
  add constraint cycle_logs_period_status_check
    check (period_status is null or period_status in ('started', 'ongoing', 'ended')),
  drop constraint if exists cycle_logs_pain_level_check,
  add constraint cycle_logs_pain_level_check
    check (pain_level is null or pain_level between 0 and 10),
  drop constraint if exists cycle_logs_energy_level_check,
  add constraint cycle_logs_energy_level_check
    check (energy_level is null or energy_level between 0 and 10),
  drop constraint if exists cycle_logs_sleep_quality_check,
  add constraint cycle_logs_sleep_quality_check
    check (sleep_quality is null or sleep_quality in ('poor', 'normal', 'good'));
```

确认这段语法在目标 Supabase/Postgres 上逐条可执行；若同一条 `alter table` 内约束依赖报错，则拆成逐条 `alter table`，但不得修改 RLS policy、grant 或数据。

在 `src/lib/cycleTrackingRepository.js`：

- 使读取字段、upsert `.select(...)`、`mapCycleLogRow`、`mapCycleLogPayload` 包含 5 个新列。
- 进/出 repository 时调用 `normalizeCycleLogs`，防止旧行和异常值进入 UI。
- 绝不把用户 ID 以外的身份字段或健康数据写入日志/控制台。

**Step 4: 运行测试并确认通过**

Run: `node scripts/test-cycle-tracking.mjs`

Expected: 映射在旧行与完整扩展行上可逆，SQL 文件只增量扩展既有权限模型。

**Step 5: 人工执行安全迁移（有登录态时）**

在用户已登录的 Supabase SQL Editor 中粘贴并执行 `supabase/cycle_tracking.sql` 新增的迁移段。检查 SQL Editor 返回成功；不要查看、复制或写入任何 API Key。

**Step 6: 提交**

```bash
git add supabase/cycle_tracking.sql src/lib/cycleTrackingRepository.js scripts/test-cycle-tracking.mjs
git commit -m "feat: persist cycle wellbeing fields"
```

---

## Task 3: 在日历中加入明确的本地/云端健康数据同意门

**Files:**

- Modify: `src/features/calendar/PlanCalendar.jsx`
- Modify: `src/styles/calendar.css`
- Modify: `scripts/test-app-smoke.mjs`

**Step 1: 写会失败的浏览器用例**

在现有“计划日历”冒烟段前插入：

1. 未登录或未同意时，能看到“记录保存在本机”的说明，且没有“已与云端同步”的成功文案。
2. 登录后通过明确、未预勾选的开关启用“允许将经期和身体状态同步到我的账户”；保存一次记录后 localStorage 的 `cycle-settings` 保存 `cloudSyncConsent: true`。
3. 关闭同意后，界面再次说明仅本机保存。

使用 role/label 断言，避免依赖 CSS 像素位置。

**Step 2: 运行并确认失败**

Run: `node scripts/test-app-smoke.mjs`

Expected: 新的同意说明与控件不存在，测试失败。

**Step 3: 以最小实现通过测试**

在 `PlanCalendar` 使用已有 `useLocalStorageState('cycle-settings', ...)` 保存：

```js
{ cloudSyncConsent: false }
```

- 默认 `false`，只接受布尔值；迁移旧值时回退为 `false`。
- 仅当 `signedIn && cloudSyncConsent` 时调用 `fetchCycleLogs`、`upsertCycleLogRemote` 和 `deleteCycleLogRemote`。关闭后不读取、不上传，页面明确展示“仅保存在这台设备”。
- 在同步开关旁说明同步目的、可随时关闭以及不会作医疗诊断；不把同意状态伪装成默认授权。
- 不改变既有登录、个人资料、非周期数据的同步行为。

在 `calendar.css` 用现有面板、字体、按钮层级定义同意行/隐私说明样式，保持移动端 430px 容器内可读且不加入新的设计语言。

**Step 4: 运行测试并确认通过**

Run: `node scripts/test-app-smoke.mjs`

Expected: 未同意不触发云端语义；选择同意后偏好持久化；现有匿名流程仍通过。

**Step 5: 提交**

```bash
git add src/features/calendar/PlanCalendar.jsx src/styles/calendar.css scripts/test-app-smoke.mjs
git commit -m "feat: gate cycle cloud sync with consent"
```

---

## Task 4: 把日历交互改为“记录今天”，并让连续事件和建议可见

**Files:**

- Modify: `src/features/calendar/PlanCalendar.jsx`
- Modify: `src/styles/calendar.css`
- Modify: `scripts/test-app-smoke.mjs`

**Step 1: 写会失败的端到端用例**

扩展日历冒烟段：

```js
await page.getByRole('button', { name: '记录今天', exact: true }).click();
await page.getByRole('button', { name: '今天开始', exact: true }).click();
await page.getByRole('button', { name: '中等', exact: true }).click();
await page.getByRole('button', { name: '疼痛 7', exact: true }).click();
await page.getByRole('button', { name: '保存记录', exact: true }).click();
await expectVisible(page.getByText('建议暂停训练', { exact: true }), 'Cycle rest adjustment');
```

随后点击同一日期验证日历是实心已记录状态、再次打开可显示“结束今天的经期”/编辑入口；选择无出血但低精力的日期，断言只显示训练调整而不打实心经期标记。以可访问名称断言，实际按钮中文以最终 UI 文案为准。

**Step 2: 运行并确认失败**

Run: `node scripts/test-app-smoke.mjs`

Expected: 顶部 CTA、事件状态、量表与建议卡片尚不存在。

**Step 3: 以最小实现通过测试**

在 `PlanCalendar.jsx`：

- 将现有 `blankForm`、`openEditor`、`saveCycleLog` 扩展为完整新字段，保持选中日期可补录、已有记录可编辑/删除、未来日期不可写。
- 在标题/说明之后放置主要按钮 `记录今天`；它始终打开 `todayKey`，避免用户先猜测点哪一个日期。保留详情区的“记录这天的身体情况”作为历史日期补录入口。
- 弹窗新增连续状态选择：`今天开始`、`进行中`、`结束今天的经期`、`今天没有开始`；出血量作为独立字段。补录/编辑使用同一表单，不新建复杂流程。
- 新增疼痛 0–10、精力 0–10、睡眠（差/一般/好）、红旗信号（头晕/异常出血）控件。保留原有常见症状和 120 字备注。
- 保存校验改为：任一状态、出血量、症状、评分、睡眠、红旗或备注存在即可；空表单提示清晰。
- 在选中日期详情下方渲染 `getCycleTrainingAdjustment(selectedCycle)` 的卡片。红旗/高疼痛时显示“今天建议暂停训练；如症状严重、持续或令你担心，请及时就医”，并标注“不构成医疗诊断”。
- 日历区分三种视觉：真实、与经期有关的已记录日为实心粉色；预测范围为浅色虚线/淡色；选中日期边框保持最高优先级。仅症状/精力记录不使用粉色经期实心标记。同步更新 `aria-label`，说明“已记录经期”与“身体状态记录”的不同。
- 预测仍只在至少两次开始日期后显示；不新增排卵、易孕、避孕或固定四阶段训练标签。

在 `calendar.css` 补齐状态按钮网格、0–10 可点击量表、红旗提示、建议卡与三态日历标记。键盘焦点、`aria-pressed`、触控目标与现有移动端间距保持一致。

**Step 4: 运行目标测试并确认通过**

Run: `node scripts/test-app-smoke.mjs`

Expected: “记录今天 → 保存 → 日历状态/训练建议 → 编辑”闭环通过，且既有 Today/Record/Profile 回归通过。

**Step 5: 提交**

```bash
git add src/features/calendar/PlanCalendar.jsx src/styles/calendar.css scripts/test-app-smoke.mjs
git commit -m "feat: add cycle recording and adaptive training guidance"
```

---

## Task 5: 回归验证、真实云端验证与交付

**Files:**

- Modify only if test reveals a defect: the smallest relevant file above

**Step 1: 运行全部本地验证**

Run:

```bash
node scripts/test-cycle-tracking.mjs
node scripts/test-app-smoke.mjs
npm run verify:maintenance
```

Expected: 所有命令退出码为 0；Vite 生产构建成功。

**Step 2: 使用默认 Edge 进行真实验证**

仅使用用户指定、已登录的 Edge：

1. 在 Supabase SQL Editor 执行 Task 2 的增量迁移并确认成功。
2. 打开已部署应用或本地 Vite 应用，登录测试账号。
3. 明确启用云端同步同意，记录“今天开始 + 出血量 + 疼痛/精力/睡眠”。
4. 刷新页面，确认记录恢复；关闭同意后记录一项新本地状态，确认界面不再声称已同步。

不得查看、复制、输出或提交 Resend/Supabase API key；不上传真实医疗文本以外的数据。

**Step 3: 审查提交范围并推送**

Run:

```bash
git status --short
git log --oneline -5
git push origin main
```

Expected: 仅提交本计划涉及的源代码、测试、SQL；排除 `.env.local`、`.superpowers/`、`NEXT_SESSION_2026-07-12.md` 与任何密钥。推送成功后，Git 集成部署会接收 main 更新。

**Step 4: 交付报告**

报告包含：实现的闭环、验证命令结果、迁移/真实 Edge 验证结果、健康数据本地/云端同意边界及未实现范围（排卵/易孕、自动识别、诊断、可穿戴接入）。引用研究结论时只使用官方 Apple/Android 文档、PIPL 原文和系统综述链接，明确“个体化调整”是依据，不夸大为医学结论。
