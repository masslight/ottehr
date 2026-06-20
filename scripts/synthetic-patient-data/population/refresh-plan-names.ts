// Re-assigns DIVERSE, UNIQUE full names to the patients in population-plan.json
// whose visits have NOT yet been created — without touching any patient that
// already has a completed visit (so existing data and repeat-visit linkage are
// preserved). Run after expanding the name pools in archetypes.ts to fix an
// in-progress build that started with too-small pools (duplicate full names,
// repeated last names) WITHOUT deleting the patients already created.
//
//   npx tsx refresh-plan-names.ts            # rewrites population-plan.json in place
//   npx tsx refresh-plan-names.ts --dry      # report only
//
// "Locked" = a patientKey with ≥1 visit marked done in population-progress.json;
// its name is kept. "Unlocked" patients (no created visit yet) get fresh names
// that are globally unique against every locked name and each other.

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES } from './archetypes';

const DRY = process.argv.includes('--dry');
const PLAN = resolve(__dirname, 'population-plan.json');
const PROGRESS = resolve(__dirname, 'population-progress.json');

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const uniq = (a: string[]): string[] => [...new Set(a)];
const F = uniq(FIRST_NAMES_F);
const M = uniq(FIRST_NAMES_M);
const L = uniq(LAST_NAMES);

// Seeded RNG (mulberry32), distinct seed so new names differ from the old plan.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260619);
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

interface Visit {
  seq: number;
  patientKey: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: 'male' | 'female';
  [k: string]: unknown;
}
const plan = JSON.parse(readFileSync(PLAN, 'utf-8')) as { meta: any; visits: Visit[] };
const progress: Record<string, { outcome: string }> = (() => {
  try {
    return JSON.parse(readFileSync(PROGRESS, 'utf-8'));
  } catch {
    return {};
  }
})();

const doneSeqs = new Set(
  Object.entries(progress)
    .filter(([, v]) => v.outcome === 'done')
    .map(([k]) => Number(k))
);

// Lock any patientKey that has at least one completed visit.
const lockedKeys = new Set<string>();
for (const v of plan.visits) if (doneSeqs.has(v.seq)) lockedKeys.add(v.patientKey);

// Reserve every locked patient's full name so new names never collide with them.
const usedNames = new Set<string>();
for (const v of plan.visits)
  if (lockedKeys.has(v.patientKey)) usedNames.add(`${slug(v.firstName)}|${slug(v.lastName)}`);

// Assign a fresh unique name per unlocked patientKey (first appearance order).
const renameByKey = new Map<string, { first: string; last: string; newKey: string }>();
let exhausted = 0;
for (const v of plan.visits) {
  if (lockedKeys.has(v.patientKey) || renameByKey.has(v.patientKey)) continue;
  const firstPool = v.sex === 'female' ? F : M;
  let first = '';
  let last = '';
  let tries = 0;
  do {
    first = pick(firstPool);
    last = pick(L);
    tries++;
  } while (usedNames.has(`${slug(first)}|${slug(last)}`) && tries < 200);
  if (tries >= 200) exhausted++;
  usedNames.add(`${slug(first)}|${slug(last)}`);
  renameByKey.set(v.patientKey, { first, last, newKey: `${slug(first)}-${slug(last)}-${v.dateOfBirth}` });
}

// Apply.
let changed = 0;
for (const v of plan.visits) {
  const r = renameByKey.get(v.patientKey);
  if (!r) continue;
  v.firstName = r.first;
  v.lastName = r.last;
  v.patientKey = r.newKey;
  changed++;
}

// Report.
const allNames = plan.visits.reduce(
  (m, v) => m.set(v.patientKey, `${v.firstName} ${v.lastName}`),
  new Map<string, string>()
);
const fullCounts = new Map<string, number>();
const lastCounts = new Map<string, number>();
for (const full of allNames.values()) fullCounts.set(full, (fullCounts.get(full) ?? 0) + 1);
for (const [, full] of allNames) {
  const last = full.split(' ').slice(-1)[0];
  lastCounts.set(last, (lastCounts.get(last) ?? 0) + 1);
}
const dupFull = [...fullCounts.values()].filter((c) => c > 1).length;
console.log(`Locked patients (kept): ${lockedKeys.size}`);
console.log(`Renamed patients:       ${renameByKey.size} (${changed} visits updated)`);
if (exhausted) console.log(`  ⚠ ${exhausted} names fell back after 200 tries (pool pressure)`);
console.log(`\nAfter refresh — across all ${allNames.size} patients:`);
console.log(`  patients sharing a full name with another: ${dupFull}`);
console.log(
  `  distinct last names: ${lastCounts.size} | max patients on one last name: ${Math.max(...lastCounts.values())}`
);

if (DRY) {
  console.log('\n[dry] plan not written.');
} else {
  writeFileSync(PLAN, JSON.stringify(plan, null, 2));
  console.log(`\nWrote ${PLAN}`);
}
