// Deterministic planner for the synthetic population. Emits population-plan.json:
// a flat, chronologically-ordered list of visit instances, each with a patient
// identity, an archetype, a date/time, a location, and the attending provider +
// intake MA. The runner (run-population.ts) materializes + executes each one.
//
// Deterministic: a fixed seed → identical plan every run, so the build is
// reproducible and the runner can resume by visit `seq`.
//
//   npx tsx population/plan-population.ts [--patients 2000] [--seed 42] [--out population-plan.json]
//
// Repeat mix (default 2000 patients): 80% one visit, 14% two, 4% three, 2% four
// → ~2560 visits over the trailing 12 months.

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  Archetype,
  ARCHETYPES,
  FIRST_NAMES_F,
  FIRST_NAMES_M,
  IN_PERSON_LOCATIONS,
  LAST_NAMES,
  MAS_BY_LOCATION,
  PROVIDERS_BY_LOCATION,
} from './archetypes';

const arg = (name: string, dflt: string): string => {
  const i = process.argv.indexOf(name);
  return i !== -1 && i < process.argv.length - 1 ? process.argv[i + 1] : dflt;
};

const TARGET_PATIENTS = parseInt(arg('--patients', '2000'), 10);
const SEED = parseInt(arg('--seed', '42'), 10);
const OUT = resolve(arg('--out', resolve(__dirname, 'population-plan.json')));

// Repeat-visit mix (fraction of patients with exactly k visits).
const REPEAT_MIX: Array<{ visits: number; frac: number }> = [
  { visits: 1, frac: 0.8 },
  { visits: 2, frac: 0.14 },
  { visits: 3, frac: 0.04 },
  { visits: 4, frac: 0.02 },
];

// Trailing 12-month window. "Today" is passed in via env so the planner stays
// pure (Date.now is fine here — this is a one-shot generator, not the harness).
const TODAY = new Date();
const WINDOW_DAYS = 365;

// ── Seeded RNG (mulberry32) ──────────────────────────────────────────────────
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
const rng = mulberry32(SEED);
const randInt = (lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

function weightedArchetype(pool: Archetype[]): Archetype {
  const total = pool.reduce((s, a) => s + a.weight, 0);
  let r = rng() * total;
  for (const a of pool) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return pool[pool.length - 1];
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ── Plan types ────────────────────────────────────────────────────────────────
interface PlannedVisit {
  seq: number;
  patientKey: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: 'male' | 'female';
  archetypeKey: string;
  archetypeLabel: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location: string;
  provider: string;
  intakeMA: string;
}

function dobForAge(ageYears: number): string {
  const d = new Date(TODAY);
  d.setFullYear(d.getFullYear() - ageYears);
  d.setDate(d.getDate() - randInt(0, 364)); // spread within the year
  return d.toISOString().slice(0, 10);
}

// A business-hours datetime on a given day offset (days before today).
function dateTimeForDayOffset(dayOffset: number): { date: string; time: string } {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - dayOffset);
  // Lightly de-weight Sunday (resample once if it lands on Sunday).
  if (d.getDay() === 0 && rng() < 0.7) d.setDate(d.getDate() - 1);
  const hour = randInt(8, 18); // 08:00–18:45 (urgent-care hours)
  const minute = pick([0, 15, 30, 45]);
  return {
    date: d.toISOString().slice(0, 10),
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

// Distinct, chronologically-spaced day offsets for a patient's k visits: split
// the window into k segments and draw one day from each (newest segment last).
function visitDayOffsets(k: number): number[] {
  const seg = WINDOW_DAYS / k;
  const offsets: number[] = [];
  for (let i = 0; i < k; i++) {
    const lo = Math.floor(i * seg) + 1;
    const hi = Math.floor((i + 1) * seg);
    offsets.push(randInt(lo, Math.max(lo, hi)));
  }
  // Newest first when we emit? We want ascending date → descending offset.
  return offsets.sort((a, b) => b - a);
}

function repeatCount(): number {
  const r = rng();
  let acc = 0;
  for (const m of REPEAT_MIX) {
    acc += m.frac;
    if (r <= acc) return m.visits;
  }
  return 1;
}

// ── Generate ──────────────────────────────────────────────────────────────────
const visits: PlannedVisit[] = [];
const usedKeys = new Set<string>();
// Full-name uniqueness: with large pools we can give every patient a distinct
// "first last" so the roster never shows the same name twice (only DOB differs).
const usedNames = new Set<string>();
// Track planned visit load per location to keep the split even.
const locLoad: Record<string, number> = Object.fromEntries(IN_PERSON_LOCATIONS.map((l) => [l, 0]));

for (let p = 0; p < TARGET_PATIENTS; p++) {
  const seed = weightedArchetype(ARCHETYPES);
  const sex: 'male' | 'female' = seed.sex === 'any' ? (rng() < 0.5 ? 'male' : 'female') : seed.sex;
  const age = randInt(seed.ageMin, seed.ageMax);
  const dob = dobForAge(age);

  // Unique FULL NAME (and therefore unique name+dob identity).
  let firstName = '';
  let lastName = '';
  let key = '';
  let tries = 0;
  do {
    firstName = pick(sex === 'female' ? FIRST_NAMES_F : FIRST_NAMES_M);
    lastName = pick(LAST_NAMES);
    key = `${slug(firstName)}-${slug(lastName)}-${dob}`;
    tries++;
  } while ((usedNames.has(`${slug(firstName)}|${slug(lastName)}`) || usedKeys.has(key)) && tries < 200);
  usedKeys.add(key);
  usedNames.add(`${slug(firstName)}|${slug(lastName)}`);

  const k = repeatCount();
  // Assign home location = whichever currently has fewer planned visits.
  const location = IN_PERSON_LOCATIONS.slice().sort((a, b) => locLoad[a] - locLoad[b])[0];
  locLoad[location] += k;

  // Archetypes compatible with this patient's fixed age + sex (for repeats).
  const compatible = ARCHETYPES.filter((a) => age >= a.ageMin && age <= a.ageMax && (a.sex === 'any' || a.sex === sex));
  const pool = compatible.length ? compatible : [seed];

  const offsets = visitDayOffsets(k);
  for (let v = 0; v < k; v++) {
    const archetype = v === 0 ? seed : weightedArchetype(pool);
    const { date, time } = dateTimeForDayOffset(offsets[v]);
    visits.push({
      seq: 0, // assigned after global sort
      patientKey: key,
      firstName,
      lastName,
      dateOfBirth: dob,
      sex,
      archetypeKey: archetype.key,
      archetypeLabel: archetype.label,
      date,
      time,
      location,
      provider: pick(PROVIDERS_BY_LOCATION[location]),
      intakeMA: pick(MAS_BY_LOCATION[location]),
    });
  }
}

// Chronological order, then assign stable seq.
visits.sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
visits.forEach((v, i) => (v.seq = i + 1));

// ── Summary ────────────────────────────────────────────────────────────────────
const byArchetype: Record<string, number> = {};
const byLocation: Record<string, number> = {};
const byProvider: Record<string, number> = {};
for (const v of visits) {
  byArchetype[v.archetypeLabel] = (byArchetype[v.archetypeLabel] ?? 0) + 1;
  byLocation[v.location] = (byLocation[v.location] ?? 0) + 1;
  byProvider[v.provider] = (byProvider[v.provider] ?? 0) + 1;
}
const months: Record<string, number> = {};
for (const v of visits) months[v.date.slice(0, 7)] = (months[v.date.slice(0, 7)] ?? 0) + 1;

const plan = {
  meta: {
    seed: SEED,
    generatedAt: TODAY.toISOString(),
    patients: TARGET_PATIENTS,
    uniquePatients: usedKeys.size,
    visits: visits.length,
    windowDays: WINDOW_DAYS,
  },
  visits,
};
writeFileSync(OUT, JSON.stringify(plan, null, 2));

console.log(`Planned ${visits.length} visits for ${usedKeys.size} unique patients (seed ${SEED}).`);
console.log(`Written: ${OUT}`);
console.log(`\nBy location:`);
for (const [l, n] of Object.entries(byLocation)) console.log(`  ${l.padEnd(14)} ${n}`);
console.log(`\nBy archetype:`);
for (const [a, n] of Object.entries(byArchetype).sort((x, y) => y[1] - x[1])) console.log(`  ${a.padEnd(34)} ${n}`);
console.log(`\nVisits per month:`);
for (const [m, n] of Object.entries(months).sort()) console.log(`  ${m}  ${n}`);
console.log(`\nProvider load (should be ~even within each location):`);
for (const [pr, n] of Object.entries(byProvider).sort((x, y) => y[1] - x[1])) console.log(`  ${pr.padEnd(20)} ${n}`);
