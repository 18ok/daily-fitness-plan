import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const host = '127.0.0.1';
const port = 4176;
const origin = `http://${host}:${port}`;
const knownLibraryConsoleErrors = [
  [
    'In HTML, %s cannot be a descendant of <%s>.',
    'This will cause a hydration error.%s <button> button ',
    '',
    '  <App>',
    '    <main className="app-stage">',
    '      <div className={"mobile-s..."}>',
    '        <Header>',
    '        <LibraryPage state={{time:"45分钟", ...}} setState={function bound dispatchSetState} ...>',
    '          <section className="sub-page l...">',
    '            <div>',
    '            <article>',
    '            <div>',
    '            <div className="template-list">',
    '>             <button className="template-card" onClick={function onClick} type="button">',
    '                <div>',
    '                <Sticker>',
    '                <div className="template-a...">',
    '>                 <button onClick={function onClick} type="button">',
    '                  ...',
    '        ...',
    '',
  ].join('\n'),
  '<%s> cannot contain a nested %s.\nSee this log for the ancestor stack trace. button <button>',
];

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
  assert.equal(await page.locator('.today-panel .result-card').count(), 4, 'All four Today result cards should remain');
  assert.equal(await page.locator('.today-panel .card-sticker').count(), 4, 'All four explanatory illustrations should remain');

  const firstSticker = page.locator('.today-panel .card-sticker').first();
  await firstSticker.evaluate((image) => image.dispatchEvent(new Event('error')));
  await page.waitForFunction(() => document.querySelectorAll('.today-panel .card-sticker').length === 3);
  assert.equal(await page.locator('.today-panel .card-sticker').count(), 3, 'A missing illustration should disappear cleanly');

  const confirmBox = await page.getByRole('button', { name: '今天就按这个做', exact: true }).boundingBox();
  assert.ok(confirmBox, 'Primary confirmation should have a bounding box');
  assert.ok(confirmBox.width >= 300, 'Primary confirmation should remain easy to tap on a 390px mobile viewport');
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
  await page.locator('.template-card').first().click();
  await expectVisible(page.locator('.template-detail-sheet'), 'Library detail');
  await page.getByRole('button', { name: '先看看', exact: true }).click();
  await page.locator('.template-detail-sheet').waitFor({ state: 'detached' });
  console.log('ok - Library detail open and close');

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
  await page.getByRole('button', { name: /^提醒时间/ }).click();
  await expectVisible(page.getByRole('dialog', { name: '提醒时间设置', exact: true }), 'Profile settings sheet');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('dialog', { name: '提醒时间设置', exact: true }).waitFor({ state: 'detached' });
  console.log('ok - signed-out sync UI and Profile settings sheet');

  await page.getByRole('button', { name: '计划日历', exact: true }).click();
  await expectVisible(page.locator('.calendar-page'), 'Calendar page');
  await page.getByRole('button', { name: '记录这天的身体情况', exact: true }).click();
  await expectVisible(page.getByRole('dialog', { name: '身体情况记录', exact: true }), 'Cycle editor');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('dialog', { name: '身体情况记录', exact: true }).waitFor({ state: 'detached' });
  console.log('ok - Calendar cycle editor open and dismiss');

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
  assert.deepEqual(
    consoleErrors,
    knownLibraryConsoleErrors,
    `Console errors did not exactly match the known LibraryPage entries:\n${consoleErrors.join('\n')}`,
  );
  console.log('ok - exact known LibraryPage console errors observed; no page errors');
  await context.close();
  console.log('\nAll app smoke checks passed.');
} finally {
  if (browser) await browser.close();
  await server.close();
}
