// Builds the before/after review page from shots-before/ and shots/.
// Usage (from apps/ehr):  node dialog-gallery/build-before-after.mjs [outDir]
// Output: <outDir>/index.html, <outDir>/before/*.png, <outDir>/after/*.png, <outDir>/files-*.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const beforeDir = path.join(here, 'shots-before');
const afterDir = path.join(here, 'shots');
const outDir = path.resolve(process.argv[2] ?? path.join(here, 'before-after-out'));
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'before'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'after'), { recursive: true });

const load = (dir) => {
  const map = new Map();
  if (!fs.existsSync(dir)) return map;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const e = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (e.status === 'ok') map.set(e.id, e);
  }
  return map;
};
const before = load(beforeDir);
const after = load(afterDir);

// Dialogs that used to be a native browser prompt have no "before" picture, only its text.
const promptsPath = path.join(here, 'native-prompts.json');
const prompts = fs.existsSync(promptsPath) ? JSON.parse(fs.readFileSync(promptsPath, 'utf8')) : {};
// Dialogs deliberately left as they are, with the reason.
const keptPath = path.join(here, 'kept-as-is.json');
const kept = fs.existsSync(keptPath) ? JSON.parse(fs.readFileSync(keptPath, 'utf8')) : {};

const AREA = {
  base: 'Shared wrappers',
  dialogs: 'components/dialogs',
  components: 'components (other)',
  sweep: 'Nursing orders',
  pages: 'pages',
  'features-a': 'features: admin, chat, DME, labs, fax, forms',
  'features-b': 'features: immunization, locations, notes, radiology, tasks',
  'visits-a': 'visits: in-person + shared',
  'visits-b': 'visits: patient, plan, review, templates',
  'telemed-admin': 'telemed admin',
  'telemed-call-rcm': 'telemed call + RCM',
};

const side = (e, dir, sub) => {
  if (!e) return null;
  fs.copyFileSync(path.join(dir, e.shot), path.join(outDir, sub, e.shot));
  const m = e.measured;
  const footer = m.buttons.filter((b) => b.inActions);
  const buttons = (footer.length ? footer : m.buttons)
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((b) => ({ label: b.label || '(icon)', variant: b.variant, color: b.color.toLowerCase() }));
  return {
    shot: `${sub}/${e.shot}`,
    w: m.paper.width,
    h: m.paper.height,
    title: m.title ? m.title.text : '',
    buttons,
    close: m.hasCloseIcon,
    base: e.base,
  };
};

const ids = [...new Set([...before.keys(), ...after.keys()])].filter((id) => !id.startsWith('app-dialog/')).sort();
const items = [];
for (const id of ids) {
  const b = before.get(id);
  const a = after.get(id);
  const meta = a ?? b;
  const bs = side(b, beforeDir, 'before');
  const as = side(a, afterDir, 'after');
  const labels = (s) => (s ? s.buttons.map((x) => x.label).join(' | ') : '');
  const migrated = Boolean(a && a.base === 'AppDialog');
  const status = kept[id] ? 'kept' : !bs ? 'new' : !as ? 'removed' : migrated ? 'migrated' : 'not-migrated';
  items.push({
    id,
    area: AREA[id.split('/')[0]] ?? id.split('/')[0],
    name: meta.title,
    source: meta.source,
    kind: meta.kind,
    where: meta.where ?? '',
    notes: (a?.notes ?? b?.notes) || '',
    before: bs,
    after: as,
    prompt: prompts[id] ?? null,
    keptWhy: kept[id] ?? null,
    status,
    titleChanged: Boolean(bs && as && bs.title !== as.title),
    buttonsChanged: Boolean(bs && as && labels(bs) !== labels(as)),
  });
}

const template = fs.readFileSync(path.join(here, 'before-after-template.html'), 'utf8');
const data = JSON.stringify({ items, builtAt: new Date().toISOString().slice(0, 10) }).replace(/</g, '\\u003c');
fs.writeFileSync(path.join(outDir, 'index.html'), template.replace(/\/\*__DATA__\*\/\s*null/, () => data));
const files = [];
for (const i of items) for (const s of [i.before, i.after]) if (s) files.push({ path: s.shot });
// One publish takes at most 255 files, so the list is written in chunks.
for (let n = 0; n * 240 < files.length; n++) {
  fs.writeFileSync(path.join(outDir, `files-${n + 1}.json`), JSON.stringify(files.slice(n * 240, (n + 1) * 240)));
}
const count = (s) => items.filter((i) => i.status === s).length;
console.log(
  `${items.length} dialogs: ${count('migrated')} migrated, ${count('new')} new, ${count('kept')} kept, ` +
    `${count('not-migrated')} not migrated, ${count('removed')} removed; ${files.length} images → ${outDir}`
);
