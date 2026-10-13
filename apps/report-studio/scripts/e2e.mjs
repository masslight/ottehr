// Headless end-to-end check of the built app against a running zambda server (and optionally the Claude
// relay). Settings come from the environment, never from the repo:
//   STUDIO_TOKEN_FILE=path  (bearer token for the zambdas)   STUDIO_ZAMBDA_URL=http://localhost:3005/local
//   STUDIO_RELAY_URL=http://127.0.0.1:8788  STUDIO_CHAT="a request"  (optional: a real Claude turn)
//   STUDIO_SHOTS=dir  (screenshots)  STUDIO_RANGE=last365days
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import path from 'path';

const shots = process.env.STUDIO_SHOTS ?? '.';
const token = process.env.STUDIO_TOKEN_FILE ? readFileSync(process.env.STUDIO_TOKEN_FILE, 'utf8').trim() : '';
const settings = {
  zambdaBaseUrl: process.env.STUDIO_ZAMBDA_URL ?? 'http://localhost:3005/local',
  accessToken: token,
  connection: 'relay',
  relayUrl: process.env.STUDIO_RELAY_URL ?? 'http://127.0.0.1:8788',
  model: process.env.STUDIO_MODEL ?? 'claude-opus-5-5',
  effort: process.env.STUDIO_EFFORT ?? 'medium',
  allowUnredactedSamples: false,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 300));
});
page.on('pageerror', (e) => errors.push(`pageerror ${e.message.slice(0, 300)}`));

const url = 'file://' + path.resolve('dist/index.html');
await page.goto(url);
await page.evaluate((s) => localStorage.setItem('reportStudio.settings.v1', JSON.stringify(s)), settings);
await page.goto(url);
await page.waitForTimeout(800);

const state = () =>
  page.evaluate(() => {
    const s = window.__studio.getState();
    return {
      run: {
        status: s.run.status,
        error: s.run.error,
        stats: s.run.fetch?.stats?.map(({ id, count, ms, mode, error }) => ({ id, count, ms, mode, error })),
        renderOk: s.run.render?.ok,
        renderMs: s.run.render?.ms,
        renderError: s.run.render?.error,
      },
      busy: s.busy,
      report: {
        name: s.report.name,
        title: s.report.title,
        steps: s.report.plan.steps.length,
        codeLen: s.report.code.length,
      },
    };
  });
const waitFor = async (pred, timeoutMs, label) => {
  const started = Date.now();
  for (;;) {
    const s = await state();
    if (pred(s)) return s;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout waiting for ${label}: ${JSON.stringify(s)}`);
    await page.waitForTimeout(500);
  }
};
const shot = (name) => page.screenshot({ path: path.join(shots, name) });
const tab = async (name) => {
  await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click();
  await page.waitForTimeout(400);
};

// 1. The default report, run by hand.
await page.evaluate(
  (preset) => window.__studio.getState().setReport({ dateRange: { preset } }),
  process.env.STUDIO_RANGE ?? 'last365days'
);
await page.getByRole('button', { name: 'Run' }).click();
const afterRun = await waitFor((s) => s.run.status === 'done' || s.run.status === 'error', 120000, 'run');
console.log('run:', JSON.stringify(afterRun.run));
await page.waitForTimeout(800);
await shot('e2e-report.png');
await tab('Plan');
await shot('e2e-plan.png');
await tab('Data');
await shot('e2e-data.png');
await tab('Code');
await shot('e2e-code.png');
await tab('Report');

// 2. Optionally a real Claude turn through the relay.
if (process.env.STUDIO_CHAT) {
  const input = page.getByPlaceholder(/Ask for a report/);
  await input.fill(process.env.STUDIO_CHAT);
  await input.press('Enter');
  await page.waitForTimeout(1500);
  await waitFor((s) => s.busy, 15000, 'chat start').catch(() => undefined);
  let last = Date.now();
  for (;;) {
    const s = await state();
    if (!s.busy) break;
    if (Date.now() - last > 20000) {
      await shot('e2e-chat-progress.png');
      last = Date.now();
      console.log('…working', JSON.stringify(s.run));
    }
    if (Date.now() - last > 15 * 60 * 1000) throw new Error('chat timeout');
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(1000);
  await shot('e2e-chat-done.png');
  const transcript = await page.evaluate(() =>
    window.__studio
      .getState()
      .chat.map((c) =>
        c.role === 'user'
          ? { user: c.text }
          : {
              assistant: c.blocks.map((b) =>
                b.type === 'text'
                  ? { text: b.text }
                  : b.type === 'tool'
                  ? { tool: b.name, status: b.status, ms: b.ms }
                  : b.type === 'changes'
                  ? { changes: b.summary }
                  : b.type === 'notice'
                  ? { notice: b.text }
                  : { thinking: (b.text || '').length }
              ),
              usage: c.usage,
              model: c.model,
            }
      )
  );
  console.log('transcript:', JSON.stringify(transcript, null, 1));
  console.log('final:', JSON.stringify(await state()));
  await tab('Plan');
  await shot('e2e-chat-plan.png');
  await tab('Report');
  await page.waitForTimeout(500);
  await shot('e2e-chat-report.png');
  const events = await page.evaluate(() => window.__studio.getState().events.map((e) => `${e.kind}: ${e.message}`));
  console.log('events:', JSON.stringify(events.slice(-40), null, 1));
}

console.log('console errors:', JSON.stringify(errors.slice(0, 10)));
await browser.close();
