import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const host = '127.0.0.1';
const port = 4176;
const origin = `http://${host}:${port}`;
const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  envFile: false,
  server: { host, port, strictPort: true },
});
let browser;

async function expectVisible(locator, label) {
  await locator.waitFor({ state: 'visible' });
  assert.equal(await locator.isVisible(), true, `${label} should be visible`);
}

try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('app-smoke-storage-initialized') !== 'true') {
      localStorage.clear();
      sessionStorage.setItem('app-smoke-storage-initialized', 'true');
      sessionStorage.setItem('app-smoke-storage-clear-count', '1');
    }
  });
  await page.goto(origin, { waitUntil: 'networkidle' });

  await expectVisible(page.locator('.selector-panel'), 'Today first-visit selector');
  const todayTouchAction = await page.locator('.page-content').evaluate((element) => getComputedStyle(element).touchAction);
  assert.match(todayTouchAction, /(^|\s)pan-y(\s|$)/, 'Today content should retain vertical touch scrolling');
  assert.match(todayTouchAction, /(^|\s)pinch-zoom(\s|$)/, 'Today content should allow pinch zoom');
  assert.equal(await page.locator('.today-panel').count(), 0, 'First visit should hide the plan before explicit answers');

  await page.getByRole('button', { name: '45分钟', exact: true }).click();
  await page.getByRole('button', { name: '白班', exact: true }).click();
  assert.equal(await page.locator('.today-panel').count(), 0, 'Two answers should not reveal a plan');

  await page.getByRole('button', { name: '家里', exact: true }).click();
  await expectVisible(page.locator('.today-panel'), 'Plan after the third explicit answer');
  await expectVisible(page.locator('.today-strategy'), 'Daily strategy summary');
  const summaryTextAlignment = await page.locator('.today-status-summary span').first().evaluate((element) => {
    const styles = getComputedStyle(element);
    return { display: styles.display, alignItems: styles.alignItems, lineHeight: styles.lineHeight };
  });
  assert.deepEqual(
    summaryTextAlignment,
    { display: 'flex', alignItems: 'center', lineHeight: '12px' },
    'Today status summary text should stay vertically centered',
  );
  assert.equal(await page.locator('.today-panel .result-card').count(), 4, 'All four Today result cards should remain');
  assert.equal(await page.locator('.today-panel .card-sticker').count(), 4, 'All four explanatory illustrations should remain');

  const firstSticker = page.locator('.today-panel .card-sticker').first();
  await firstSticker.evaluate((image) => image.dispatchEvent(new Event('error')));
  await page.waitForFunction(() => document.querySelectorAll('.today-panel .card-sticker').length === 3);
  assert.equal(await page.locator('.today-panel .card-sticker').count(), 3, 'A missing illustration should disappear cleanly');

  const confirmBox = await page.getByRole('button', { name: '今天就按这个做', exact: true }).boundingBox();
  assert.ok(confirmBox, 'Primary confirmation should have a bounding box');
  assert.ok(confirmBox.width >= 300, 'Primary confirmation should remain easy to tap on a 390px mobile viewport');
  const actionOverlapsPlanCard = await page.evaluate(() => {
    const actionRect = document.querySelector('.confirm-plan').getBoundingClientRect();
    return [...document.querySelectorAll('.today-panel .result-card')].some((card) => {
      const cardRect = card.getBoundingClientRect();
      return !(
        actionRect.bottom <= cardRect.top ||
        actionRect.top >= cardRect.bottom ||
        actionRect.right <= cardRect.left ||
        actionRect.left >= cardRect.right
      );
    });
  });
  assert.equal(actionOverlapsPlanCard, false, 'Primary confirmation must not cover any plan card');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('today-plan-state') || 'null');
    return state?.time === '45分钟' && state.status === '白班' && state.condition === '家里';
  });
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem('today-plan-state'))),
    { time: '45分钟', status: '白班', condition: '家里' },
    'Today selections should persist before confirmation',
  );

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

  await expectVisible(page.getByText('这个计划适合你今天吗？', { exact: true }), 'Pilot feedback prompt');
  await page.getByRole('button', { name: '太难', exact: true }).click();
  await page.getByPlaceholder('可以补充一句，选填').fill('动作说明还不够具体');
  await page.getByRole('button', { name: '提交反馈', exact: true }).click();
  await expectVisible(page.getByText('反馈已保存在本机，联网后会自动提交。', { exact: true }), 'Queued feedback state');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('today-plan-feedback-pending') || 'null')?.rating === '太难');
  console.log('ok - anonymous pilot feedback queues without Supabase');

  await page.getByRole('button', { name: '记录', exact: true }).click();
  await expectVisible(page.locator('.record-page'), 'Record page');
  await page.getByRole('button', { name: /^吃饭完成/ }).click();
  await page.getByRole('button', { name: '轻松', exact: true }).click();
  await page.getByRole('button', { name: '吃少了', exact: true }).click();
  await page.waitForFunction(() => {
    const checks = JSON.parse(localStorage.getItem('record-checks') || '[]');
    const energy = JSON.parse(localStorage.getItem('record-energy') || 'null');
    const appetite = JSON.parse(localStorage.getItem('record-appetite') || 'null');
    return checks.includes('吃饭完成') && energy === '轻松' && appetite === '吃少了';
  });
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem('record-checks'))),
    ['训练完成', '喝水完成', '吃饭完成'],
    'Record completion changes should persist before save',
  );
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem('record-energy'))),
    '轻松',
    'Record energy should persist before save',
  );
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem('record-appetite'))),
    '吃少了',
    'Record appetite should persist before save',
  );
  await page.getByRole('button', { name: '保存记录并签到', exact: true }).click();
  await expectVisible(page.getByRole('button', { name: '今日已签到', exact: true }), 'Saved record state');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('care-history') || '[]').length === 1);
  console.log('ok - Record save and persistence');

  await page.getByRole('button', { name: '计划库', exact: true }).click();
  await expectVisible(page.locator('.library-page'), 'Library page');
  await page.locator('.template-detail-trigger').first().click();
  await expectVisible(page.locator('.template-detail-sheet'), 'Library detail');
  await page.locator('.template-detail-sheet').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const detailActionBox = await page.getByRole('button', { name: '套用这个计划', exact: true }).boundingBox();
  assert.ok(
    detailActionBox && detailActionBox.y + detailActionBox.height <= 844,
    `Template action should remain within the mobile viewport: ${JSON.stringify(detailActionBox)}`,
  );
  await page.getByRole('button', { name: '套用这个计划', exact: true }).click();
  await page.locator('.template-detail-sheet').waitFor({ state: 'detached' });
  await expectVisible(page.getByText(/已套用「/), 'Applied template feedback');
  await page.evaluate(() => {
    localStorage.setItem('today-plan-state', JSON.stringify({ time: '45分钟', status: '白班', condition: '家里' }));
  });
  console.log('ok - Library detail action remains reachable and applies the template');

  await page.getByRole('button', { name: '能量贴纸', exact: true }).click();
  await expectVisible(page.locator('.sticker-page'), 'Sticker page');
  await page.locator('.today-sticker-card').click();
  await expectVisible(page.locator('.sticker-detail-sheet'), 'Sticker detail');
  await page.getByRole('button', { name: '收起', exact: true }).click();
  await page.locator('.sticker-detail-sheet').waitFor({ state: 'detached' });
  console.log('ok - Sticker detail open and close');

  await page.getByRole('button', { name: '我的', exact: true }).click();
  await expectVisible(page.locator('.profile-page'), 'Profile page');
  await expectVisible(page.getByText('还没有配置 Supabase，同步功能暂时不可用。', { exact: true }), 'Unconfigured sync status');
  await expectVisible(page.getByPlaceholder('登录邮箱'), 'Signed-out email field');
  await expectVisible(page.getByPlaceholder('登录密码'), 'Signed-out password field');
  await expectVisible(page.getByRole('button', { name: '登录并同步', exact: true }), 'Signed-out login action');
  await page.getByPlaceholder('登录邮箱').fill('pilot@example.com');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '我的', exact: true }).click();
  assert.equal(
    await page.getByPlaceholder('登录邮箱').inputValue(),
    'pilot@example.com',
    'The last login email should remain available after a reload',
  );
  await page.evaluate(() => {
    localStorage.setItem('profile-pending-confirmation-email', JSON.stringify('pilot@example.com'));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '我的', exact: true }).click();
  await expectVisible(
    page.getByRole('button', { name: '没收到验证邮件？重新发送', exact: true }),
    'Confirmation email resend action',
  );
  await page.getByRole('button', { name: '还没有账号？创建一个', exact: true }).click();
  await expectVisible(page.getByPlaceholder('再次输入密码'), 'Registration password confirmation');
  await expectVisible(page.getByRole('button', { name: '创建账号', exact: true }), 'Registration action');
  const registrationToggleBox = await page.getByRole('button', { name: '已有账号，去登录', exact: true }).boundingBox();
  const profileStatsBox = await page.locator('.profile-stats').boundingBox();
  assert.ok(
    registrationToggleBox && profileStatsBox && registrationToggleBox.y + registrationToggleBox.height <= profileStatsBox.y,
    `Registration toggle should not be covered by profile stats: ${JSON.stringify({ registrationToggleBox, profileStatsBox })}`,
  );
  await page.getByRole('button', { name: '已有账号，去登录', exact: true }).click();
  await page.getByRole('button', { name: /^提醒时间/ }).click();
  await expectVisible(page.getByRole('dialog', { name: '提醒时间设置', exact: true }), 'Profile settings sheet');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('dialog', { name: '提醒时间设置', exact: true }).waitFor({ state: 'detached' });
  await page.getByText('训练偏好', { exact: true }).click();
  await expectVisible(page.getByRole('dialog', { name: '训练资料设置', exact: true }), 'Training profile sheet');
  await page.getByRole('button', { name: '久坐后起身', exact: true }).click();
  await page.getByRole('button', { name: '建立习惯', exact: true }).click();
  await page.getByRole('button', { name: '从没练过', exact: true }).click();
  await page.getByLabel('身高（cm）', { exact: true }).fill('165.5');
  await page.getByLabel('本周体重（kg）', { exact: true }).fill('61.2');
  await page.getByRole('button', { name: '弹力带', exact: true }).click();
  await page.getByRole('button', { name: '2kg', exact: true }).click();
  await page.getByLabel('自定义哑铃重量（kg）', { exact: true }).fill('2.5');
  await page.getByRole('button', { name: '添加重量', exact: true }).click();
  const customWeightChip = page.getByRole('button', { name: '2.5kg ×', exact: true });
  await expectVisible(customWeightChip, 'Custom dumbbell weight chip');
  const customWeightChipBox = await customWeightChip.boundingBox();
  assert.ok(
    customWeightChipBox && customWeightChipBox.height >= 44,
    `Removable custom weight chip should have a 44px target: ${JSON.stringify(customWeightChipBox)}`,
  );
  await page.getByRole('button', { name: '保存训练资料', exact: true }).click();
  await page.waitForFunction(() => {
    const profile = JSON.parse(localStorage.getItem('training-profile') || '{}');
    const trend = JSON.parse(localStorage.getItem('body-trend-history') || '[]');
    return profile.goal === 'habit'
      && profile.heightCm === 165.5
      && profile.movementLimits?.includes('stand_after_sitting')
      && profile.equipment?.bands === true
      && profile.equipment?.customDumbbellKg?.includes(2.5)
      && trend.length === 1
      && trend[0]?.weightKg === 61.2;
  });
  await page.evaluate(() => {
    localStorage.setItem('body-trend-history', JSON.stringify([{ date: '2026-07-01', weightKg: 60 }]));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '我的', exact: true }).click();
  await page.getByText('训练偏好', { exact: true }).click();
  await expectVisible(page.getByRole('dialog', { name: '训练资料设置', exact: true }), 'Restored training profile sheet');
  assert.equal(await page.getByLabel('身高（cm）', { exact: true }).inputValue(), '165.5');
  assert.equal(await page.getByLabel('本周体重（kg）', { exact: true }).inputValue(), '60');
  assert.equal(await page.getByRole('button', { name: '弹力带', exact: true }).getAttribute('aria-pressed'), 'true');
  await expectVisible(page.getByRole('button', { name: '2.5kg ×', exact: true }), 'Restored custom weight chip');
  await page.getByRole('button', { name: '健身房器械', exact: true }).click();
  await page.getByRole('button', { name: '保存训练资料', exact: true }).click();
  await page.waitForFunction(() => {
    const trend = JSON.parse(localStorage.getItem('body-trend-history') || '[]');
    return trend.length === 1 && trend[0]?.date === '2026-07-01' && trend[0]?.weightKg === 60;
  });
  await page.locator('.profile-edit-trigger').click();
  await expectVisible(page.getByRole('dialog', { name: '编辑个人资料', exact: true }), 'Profile edit sheet');
  await page.locator('.profile-edit-sheet').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const profileActionBox = await page.getByRole('button', { name: '保存我的资料', exact: true }).boundingBox();
  assert.ok(
    profileActionBox && profileActionBox.y + profileActionBox.height <= 844,
    `Profile action should remain within the mobile viewport: ${JSON.stringify(profileActionBox)}`,
  );
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('dialog', { name: '编辑个人资料', exact: true }).waitFor({ state: 'detached' });
  console.log('ok - signed-out sync registration UI and Profile sheet actions');

  await page.getByRole('button', { name: '计划日历', exact: true }).click();
  await expectVisible(page.locator('.calendar-page'), 'Calendar page');
  await expectVisible(page.getByText('经期和身体状态记录仅保存在这台设备。', { exact: true }), 'Local-only cycle privacy notice');
  await page.getByRole('button', { name: '记录今天', exact: true }).click();
  await expectVisible(page.getByRole('dialog', { name: '身体情况记录', exact: true }), 'Cycle editor');
  await page.getByRole('button', { name: '今天开始', exact: true }).click();
  await page.getByRole('button', { name: '中等', exact: true }).click();
  await page.getByRole('button', { name: '疼痛 7', exact: true }).click();
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await page.getByRole('dialog', { name: '身体情况记录', exact: true }).waitFor({ state: 'detached' });
  await expectVisible(page.getByText('建议暂停训练', { exact: true }), 'Cycle rest adjustment');
  await page.waitForFunction(() => {
    const logs = JSON.parse(localStorage.getItem('cycle-logs') || '[]');
    return logs.some((entry) => entry.periodStatus === 'started' && entry.painLevel === 7);
  });
  assert.equal(await page.locator('.calendar-day.is-selected.has-period-record').count(), 1, 'Recorded period day should be solid');
  await page.getByRole('button', { name: '修改这天的身体记录', exact: true }).click();
  await expectVisible(page.getByRole('dialog', { name: '身体情况记录', exact: true }), 'Cycle editor reopens for editing');
  await page.getByRole('button', { name: '今天没有开始', exact: true }).click();
  await page.getByRole('button', { name: '中等', exact: true }).click();
  await page.getByRole('button', { name: '疼痛 7', exact: true }).click();
  await page.getByRole('button', { name: '精力 5', exact: true }).click();
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expectVisible(page.getByText('今天建议轻量训练', { exact: true }), 'Cycle light adjustment');
  assert.equal(await page.locator('.calendar-day.is-selected.has-period-record').count(), 0, 'Body-only status should not be styled as a period');
  assert.equal(await page.locator('.calendar-day.is-selected.has-body-record').count(), 1, 'Body-only status should remain visible');
  console.log('ok - Calendar records continuous events and distinguishes body-only guidance');

  const storageBeforeReload = await page.evaluate(() => ({
    plan: localStorage.getItem('daily-plan-history'),
    care: localStorage.getItem('care-history'),
    clearCount: sessionStorage.getItem('app-smoke-storage-clear-count'),
  }));
  await page.reload({ waitUntil: 'networkidle' });
  const storageAfterReload = await page.evaluate(() => ({
    plan: localStorage.getItem('daily-plan-history'),
    care: localStorage.getItem('care-history'),
    clearCount: sessionStorage.getItem('app-smoke-storage-clear-count'),
  }));
  assert.deepEqual(storageAfterReload, storageBeforeReload, 'Reload should preserve generated plans and saved records');
  assert.equal(storageAfterReload.clearCount, '1', 'localStorage should be cleared only once');
  await expectVisible(page.locator('.today-status-summary'), 'Returning selection summary');
  await expectVisible(page.locator('.today-panel'), 'Returning automatic plan preview');
  await expectVisible(page.getByRole('button', { name: '今天计划已确认', exact: true }), 'Restored confirmation state');
  assert.equal(await page.locator('.selector-panel').count(), 0, 'Returning users should not see expanded selectors by default');
  await page.getByRole('button', { name: '记录', exact: true }).click();
  await expectVisible(page.getByRole('button', { name: '今日已签到', exact: true }), 'Restored saved record');
  console.log('ok - refresh restoration without clearing storage');

  await page.setViewportSize({ width: 1280, height: 1000 });
  const shellBox = await page.locator('.mobile-shell').boundingBox();
  assert.ok(shellBox, 'Desktop shell should have a bounding box');
  assert.equal(shellBox.width, 430, 'Desktop shell should retain its 430px frame');
  assert.equal(shellBox.height, 932, 'Desktop shell should retain its 932px frame');
  assert.equal(shellBox.x, 425, 'Desktop shell should be horizontally centered');
  assert.equal(shellBox.y, 34, 'Desktop shell should be vertically centered');
  console.log('ok - desktop framing');

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

  assert.deepEqual(pageErrors, [], `Page errors:\n${pageErrors.join('\n')}`);
  assert.deepEqual(consoleErrors, [], `Console errors:\n${consoleErrors.join('\n')}`);
  console.log('ok - no page errors or console errors');
  await context.close();
  console.log('\nAll app smoke checks passed.');
} finally {
  if (browser) await browser.close();
  await server.close();
}
