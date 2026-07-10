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

  await expectVisible(page.locator('.selector-panel'), 'Today selector');
  await page.getByRole('button', { name: '45分钟', exact: true }).click();
  await page.getByRole('button', { name: '白班', exact: true }).click();
  await page.getByRole('button', { name: '家里', exact: true }).click();
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('today-plan-state') || 'null');
    return state?.time === '45分钟' && state.status === '白班' && state.condition === '家里';
  });
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem('today-plan-state'))),
    { time: '45分钟', status: '白班', condition: '家里' },
    'Today selections should persist before generation',
  );
  await page.getByRole('button', { name: '生成今日计划', exact: true }).click();
  await expectVisible(page.getByRole('button', { name: '今日计划已生成', exact: true }), 'Generated-plan state');
  await page.getByRole('button', { name: '保存计划', exact: true }).click();
  await expectVisible(page.getByRole('button', { name: '已保存', exact: true }), 'Saved-plan state');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('daily-plan-history') || '[]')[0]?.saved === true);
  console.log('ok - Today generation and persistence');

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
  await expectVisible(page.getByRole('button', { name: '今日计划已生成', exact: true }), 'Restored generated plan');
  await expectVisible(page.getByRole('button', { name: '已保存', exact: true }), 'Restored saved plan');
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
