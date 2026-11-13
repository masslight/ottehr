// Screenshots every story served by the gallery dev server and records measured style facts.
// Usage (from apps/ehr, dev server running on :4555):
//   node dialog-gallery/capture.mjs [id-prefix ...]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:4555/dialog-gallery/index.html';
const outDir = path.join(here, 'shots');
const filters = process.argv.slice(2);

const SURFACE =
  '.MuiDialog-paper, .MuiDrawer-paper, .MuiModal-root:not(.MuiDialog-root):not(.MuiDrawer-root) > :not(.MuiBackdrop-root):not([data-testid="sentinelStart"]):not([data-testid="sentinelEnd"])';

const measure = (surfaceSel) => {
  const surfaces = [...document.querySelectorAll(surfaceSel)].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  });
  const el = surfaces[surfaces.length - 1];
  if (!el) return null;
  const cs = (n) => getComputedStyle(n);
  const r = el.getBoundingClientRect();
  const s = cs(el);
  const text = (n) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const titleEl =
    el.querySelector('.MuiDialogTitle-root') ??
    el.querySelector('h1,h2,h3,h4,h5,h6,.MuiTypography-h4,.MuiTypography-h5,.MuiTypography-h6');
  const actionsEl = el.querySelector('.MuiDialogActions-root');
  const contentEl = el.querySelector('.MuiDialogContent-root');
  const buttons = [...el.querySelectorAll('button.MuiButton-root, a.MuiButton-root')].map((b) => {
    const c = cs(b);
    const cls = b.className;
    return {
      label: text(b),
      variant: /MuiButton-contained/.test(cls) ? 'contained' : /MuiButton-outlined/.test(cls) ? 'outlined' : 'text',
      color: (cls.match(/MuiButton-color(\w+)/) ?? [])[1] ?? 'primary',
      inActions: !!b.closest('.MuiDialogActions-root'),
      radius: c.borderTopLeftRadius,
      textTransform: c.textTransform,
      fontWeight: c.fontWeight,
      height: Math.round(b.getBoundingClientRect().height),
      x: Math.round(b.getBoundingClientRect().left - r.left),
    };
  });
  const closeIcon = [...el.querySelectorAll('button.MuiIconButton-root')].find((b) => {
    const br = b.getBoundingClientRect();
    return br.top - r.top < 72 && r.right - br.right < 72;
  });
  return {
    surfaceCount: surfaces.length,
    box: { x: r.x, y: r.y, width: r.width, height: r.height },
    paper: {
      width: Math.round(r.width),
      height: Math.round(r.height),
      padding: s.padding,
      radius: s.borderTopLeftRadius,
      maxWidth: s.maxWidth,
      muiMaxWidth: (el.className.match(/MuiDialog-paperWidth(\w+)/) ?? [])[1] ?? null,
      fullWidth: /MuiDialog-paperFullWidth/.test(el.className),
      fullScreen: /MuiDialog-paperFullScreen/.test(el.className),
    },
    title: titleEl
      ? {
          text: text(titleEl).slice(0, 120),
          isDialogTitle: titleEl.classList.contains('MuiDialogTitle-root'),
          fontSize: cs(titleEl).fontSize,
          fontWeight: cs(titleEl).fontWeight,
          color: cs(titleEl).color,
          padding: cs(titleEl).padding,
          align: cs(titleEl).textAlign,
        }
      : null,
    content: contentEl
      ? { padding: cs(contentEl).padding, dividers: contentEl.classList.contains('MuiDialogContent-dividers') }
      : null,
    actions: actionsEl
      ? {
          justify: cs(actionsEl).justifyContent,
          padding: cs(actionsEl).padding,
          labels: buttons.filter((b) => b.inActions).map((b) => b.label),
        }
      : null,
    hasDialogActions: !!actionsEl,
    hasCloseIcon: !!closeIcon,
    buttons,
  };
};

// CHROMIUM_PATH lets a sandbox with a preinstalled browser skip `playwright install`.
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
});
const listPage = await ctx.newPage();
await listPage.goto(`${base}?list`);
let ids = JSON.parse(await listPage.locator('#ids').textContent());
await listPage.close();
if (filters.length) ids = ids.filter((id) => filters.some((f) => id.startsWith(f)));

fs.mkdirSync(outDir, { recursive: true });
let ok = 0;
const problems = [];

for (const id of ids) {
  const page = await ctx.newPage();
  const logs = [];
  page.on(
    'console',
    (m) => (m.type() === 'error' || m.text().includes('[gallery]')) && logs.push(m.text().slice(0, 400))
  );
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message.slice(0, 400)}`));
  // Nothing may leave the sandbox: third-party scripts, fonts, images, etc. are aborted.
  await page.route('**/*', (route) =>
    route.request().url().startsWith('http://127.0.0.1:4555') ? route.continue() : route.abort()
  );
  const file = id.replace(/\//g, '__');
  const entry = { id, status: 'error' };
  for (const stale of ['.png', '.full.png', '.error.png', '.json'])
    fs.rmSync(path.join(outDir, file + stale), { force: true });
  try {
    await page.goto(`${base}?story=${encodeURIComponent(id)}`);
    await page.waitForFunction(() => window.__story && window.__story.status !== 'loading', null, { timeout: 45000 });
    const story = await page.evaluate(() => window.__story);
    Object.assign(entry, story.meta ?? {});
    if (story.status === 'error') throw new Error(story.error);
    await page.locator(SURFACE).last().waitFor({ state: 'visible', timeout: 8000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const m = await page.evaluate(measure, SURFACE);
    if (!m) throw new Error('No dialog surface found');
    await page.screenshot({ path: path.join(outDir, `${file}.full.png`) });
    const pad = 24;
    const clip = {
      x: Math.max(0, m.box.x - pad),
      y: Math.max(0, m.box.y - pad),
      width: Math.min(1440, m.box.x + m.box.width + pad) - Math.max(0, m.box.x - pad),
      height: Math.min(900, m.box.y + m.box.height + pad) - Math.max(0, m.box.y - pad),
    };
    await page.screenshot({ path: path.join(outDir, `${file}.png`), clip });
    delete m.box;
    Object.assign(entry, { status: 'ok', shot: `${file}.png`, full: `${file}.full.png`, measured: m });
    entry.unmatched = await page.evaluate(() => window.__unmatched ?? []);
    ok++;
    console.log(
      `ok    ${id}  ${m.paper.width}x${m.paper.height}${
        entry.unmatched.length ? `  (unmatched requests: ${entry.unmatched.length})` : ''
      }`
    );
  } catch (e) {
    entry.error = String(e.message ?? e).slice(0, 1500);
    entry.logs = logs.slice(-12);
    await page.screenshot({ path: path.join(outDir, `${file}.error.png`) }).catch(() => {});
    problems.push(id);
    console.log(`FAIL  ${id}\n      ${entry.error.split('\n')[0]}\n      ${logs.slice(-6).join('\n      ')}`);
  }
  // One JSON per story, so parallel runs over different prefixes never clobber each other.
  fs.writeFileSync(path.join(outDir, `${file}.json`), JSON.stringify(entry, null, 2));
  await page.close();
}
await browser.close();
console.log(`\n${ok}/${ids.length} captured${problems.length ? `; failed: ${problems.join(', ')}` : ''}`);
