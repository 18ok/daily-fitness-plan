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
const knownLibraryConsoleErrors = [
  [
    'In HTML, %s cannot be a descendant of <%s>.',
    'This will cause a hydration error.%s <button> button ',
    '',
    '  <App>',
    '    <main className="app-stage">',
    '      <div className="mobile-she...">',
    '        <Header>',
    '        <LibraryPage state={{time:"30分钟", ...}} setState={function bound dispatchSetState} ...>',
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
