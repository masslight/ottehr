// Opens the built single-file app from file:// in headless Chromium, prints console errors and saves a screenshot.
// usage: node scripts/shot.mjs [out.png] [waitMs]
import { chromium } from 'playwright';
import path from 'path';

const out = process.argv[2] ?? 'shot.png';
const wait = Number(process.argv[3] ?? 1500);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text().slice(0, 400));
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 600)));
await page.goto('file://' + path.resolve('dist/index.html'));
await page.waitForTimeout(wait);
await page.screenshot({ path: out });
await browser.close();
