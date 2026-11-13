// Builds the side-by-side contact sheet from shots/*.json + shots/*.png.
// Usage (from apps/ehr):  node dialog-gallery/build-gallery.mjs [outDir]
// Output: <outDir>/index.html, <outDir>/shots/*.png, <outDir>/files.json (list of published image paths)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shotsDir = path.join(here, 'shots');
const outDir = path.resolve(process.argv[2] ?? path.join(here, 'gallery-out'));
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'shots'), { recursive: true });

const AREA = {
  base: 'Shared base components',
  dialogs: 'components/dialogs',
  components: 'components (other)',
  pages: 'pages',
  'features-a': 'features: admin, chat, DME, labs, fax, forms',
  'features-b': 'features: immunization, locations, notes, radiology, tasks',
  'visits-a': 'visits: in-person + shared',
  'visits-b': 'visits: patient, plan, review, templates',
  'telemed-admin': 'telemed admin',
  'telemed-call-rcm': 'telemed call + RCM',
};

const px = (v) => Math.round(parseFloat(v) || 0);
const rgbToHex = (c) => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c ?? '');
  return m ? '#' + [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('') : c ?? '';
};

const entries = fs
  .readdirSync(shotsDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(shotsDir, f), 'utf8')));

const items = [];
const failed = [];
for (const e of entries.sort((a, b) => a.id.localeCompare(b.id))) {
  if (e.status !== 'ok') {
    failed.push({ id: e.id, title: e.title ?? e.id, source: e.source ?? '', error: (e.error ?? '').split('\n')[0] });
    continue;
  }
  fs.copyFileSync(path.join(shotsDir, e.shot), path.join(outDir, 'shots', e.shot));
  const m = e.measured;
  const acts = m.buttons.filter((b) => b.inActions);
  const footer = acts.length ? acts : m.buttons;
  const primaryIdx = footer.findIndex((b) => b.variant === 'contained');
  const byX = [...footer].sort((a, b) => a.x - b.x);
  const primaryPos =
    primaryIdx < 0 || footer.length < 2
      ? footer.length < 2
        ? 'single button / none'
        : 'no filled button'
      : byX[0] === footer[primaryIdx]
        ? 'primary on the left'
        : byX[byX.length - 1] === footer[primaryIdx]
          ? 'primary on the right'
          : 'primary in the middle';
  const p = m.paper;
  const width = p.fullScreen
    ? 'full screen'
    : p.muiMaxWidth && p.muiMaxWidth !== 'False'
      ? `${p.muiMaxWidth.toLowerCase()}${p.fullWidth ? ' · fullWidth' : ''}`
      : 'custom width';
  const radii = [...new Set(m.buttons.map((b) => (px(b.radius) >= 50 ? 'pill' : `${px(b.radius)}px`)))];
  items.push({
    id: e.id,
    area: AREA[e.id.split('/')[0]] ?? e.id.split('/')[0],
    title: e.title,
    source: e.source,
    base: e.base,
    kind: e.kind,
    where: e.where ?? '',
    notes: e.notes ?? '',
    shot: `shots/${e.shot}`,
    w: p.width,
    h: p.height,
    facets: {
      base: e.base,
      kind: e.kind,
      area: AREA[e.id.split('/')[0]] ?? e.id.split('/')[0],
      width,
      title: m.title
        ? `${px(m.title.fontSize)}px / ${m.title.fontWeight}${m.title.isDialogTitle ? '' : ' (not DialogTitle)'}`
        : 'no title',
      titleColor: m.title ? rgbToHex(m.title.color) : 'no title',
      close: m.hasCloseIcon ? 'has ✕ close icon' : 'no close icon',
      actions: m.actions ? `DialogActions · ${m.actions.justify}` : 'no DialogActions',
      primary: primaryPos,
      paperPad: `${p.padding} paper padding`,
      radius: p.radius,
      buttonShape: radii.length ? radii.join(' + ') : 'no buttons',
    },
    detail: {
      paper: `${p.width}×${p.height}px, padding ${p.padding}, radius ${p.radius}, max-width ${p.maxWidth}`,
      title: m.title
        ? `“${m.title.text}” ${m.title.fontSize}/${m.title.fontWeight} ${rgbToHex(m.title.color)}, padding ${m.title.padding}, align ${m.title.align}`
        : 'none',
      content: m.content ? `padding ${m.content.padding}${m.content.dividers ? ', dividers' : ''}` : 'no DialogContent',
      actions: m.actions ? `justify ${m.actions.justify}, padding ${m.actions.padding}` : 'no DialogActions',
      buttons: m.buttons.map((b) => `${b.label || '(icon)'} — ${b.variant}/${b.color.toLowerCase()}, ${b.height}px tall, radius ${b.radius}${b.inActions ? '' : ', outside actions'}`),
    },
  });
}

const missingPath = path.join(here, 'not-captured.json');
const missing = fs.existsSync(missingPath) ? JSON.parse(fs.readFileSync(missingPath, 'utf8')) : [];

const template = fs.readFileSync(path.join(here, 'gallery-template.html'), 'utf8');
const data = JSON.stringify({ items, failed, missing, builtAt: new Date().toISOString().slice(0, 10) }).replace(/</g, '\\u003c');
fs.writeFileSync(path.join(outDir, 'index.html'), template.replace('/*__DATA__*/null', data));
fs.writeFileSync(path.join(outDir, 'files.json'), JSON.stringify(items.map((i) => ({ path: i.shot }))));
const bytes = items.reduce((n, i) => n + fs.statSync(path.join(outDir, i.shot)).size, 0);
console.log(`${items.length} dialogs, ${failed.length} failed, ${missing.length} listed as not captured, images ${(bytes / 1e6).toFixed(1)}MB → ${outDir}`);
