// Orchestrates the population build: reads population-plan.json, materializes a
// scenario JSON per visit (clones the archetype example + overrides patient
// identity, date, location), and runs synthesize-visit.ts --execute with the
// planned attending provider + intake MA, at bounded concurrency. Resumable: a
// progress file records each visit's outcome so a re-run skips completed ones.
//
// Run UNDER the synth env (children inherit AUTH0_* / PROJECT_*):
//   npx env-cmd -f packages/zambdas/.env/synth.json \
//     npx tsx scripts/synthetic-patient-data/population/run-population.ts \
//     [--concurrency 4] [--limit N] [--from SEQ] [--to SEQ] [--redo] [--dry]
//
// Pilot: --limit 25 runs the first 25 (chronologically-earliest) visits.

import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { arg, argInt, flag } from '../shared/cli';

const HERE = __dirname;
const SYNTH = resolve(HERE, '..', 'synthesize-visit.ts');
const EXAMPLES = resolve(HERE, '..', 'examples');
const PLAN_PATH = resolve(arg('--plan', resolve(HERE, 'population-plan.json')));
const PROGRESS_PATH = resolve(arg('--progress', resolve(HERE, 'population-progress.json')));
const SCEN_DIR = resolve(HERE, '.scenarios');
const LOG_DIR = resolve(HERE, '.logs');

const CONCURRENCY = argInt('--concurrency', { default: 4, min: 1 });
const LIMIT = argInt('--limit', { default: 0, min: 0 }); // 0 = no limit
const FROM = argInt('--from', { default: 0, min: 0 });
const TO = argInt('--to', { default: 0, min: 0 }); // 0 = no upper bound
const REDO = flag('--redo');
const DRY = flag('--dry');

interface PlannedVisit {
  seq: number;
  patientKey: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: 'male' | 'female';
  archetypeKey: string;
  archetypeLabel: string;
  date: string;
  time: string;
  location: string;
  provider: string;
  intakeMA: string;
}
interface Plan {
  meta: Record<string, unknown>;
  visits: PlannedVisit[];
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// archetypeKey → example file. Imported lazily to avoid a hard dep cycle.
import { ARCHETYPE_BY_KEY } from './archetypes';

type Outcome = 'done' | 'failed';
type Progress = Record<string, { outcome: Outcome; at: string; error?: string }>;

function loadProgress(): Progress {
  if (!existsSync(PROGRESS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(PROGRESS_PATH, 'utf-8')) as Progress;
  } catch {
    return {};
  }
}
const progress: Progress = loadProgress();
let dirty = false;
function recordOutcome(seq: number, outcome: Outcome, error?: string): void {
  progress[String(seq)] = { outcome, at: new Date().toISOString(), ...(error ? { error: error.slice(0, 400) } : {}) };
  dirty = true;
}
function flushProgress(): void {
  if (!dirty) return;
  writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
  dirty = false;
}

// Build the per-visit scenario file by cloning the archetype and overriding
// identity + visit fields. Returns the scenario file path.
function materializeScenario(v: PlannedVisit): string {
  const arch = ARCHETYPE_BY_KEY[v.archetypeKey];
  if (!arch) throw new Error(`unknown archetype ${v.archetypeKey}`);
  const base = JSON.parse(readFileSync(resolve(EXAMPLES, arch.file), 'utf-8'));

  base.label = `${v.firstName} ${v.lastName} — ${arch.label} (seq ${v.seq})`;
  base.patient = {
    ...base.patient,
    firstName: v.firstName,
    lastName: v.lastName,
    dateOfBirth: v.dateOfBirth,
    sex: v.sex,
    email: `${slug(v.firstName)}.${slug(v.lastName)}.${v.seq}@example.com`,
  };
  base.visit = {
    ...base.visit,
    date: v.date,
    time: v.time,
    locationName: v.location,
    // The population is "all signed completed visits" — most archetypes were
    // authored at an earlier lifecycle stage (intake/ready/provider/etc.) to
    // demo mid-visit states, so force the full walk + sign-off here.
    targetStatus: 'completed',
  };
  base.signOff = { ...(base.signOff ?? {}), complete: true };

  if (!existsSync(SCEN_DIR)) mkdirSync(SCEN_DIR, { recursive: true });
  const file = resolve(SCEN_DIR, `seq-${String(v.seq).padStart(5, '0')}.json`);
  writeFileSync(file, JSON.stringify(base, null, 2));
  return file;
}

function runOne(v: PlannedVisit): Promise<void> {
  return new Promise((resolvePromise) => {
    let scenarioFile: string;
    try {
      scenarioFile = materializeScenario(v);
    } catch (err) {
      recordOutcome(v.seq, 'failed', err instanceof Error ? err.message : String(err));
      console.log(`  ✗ seq ${v.seq} materialize failed: ${err instanceof Error ? err.message : err}`);
      return resolvePromise();
    }

    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    const logFile = resolve(LOG_DIR, `seq-${String(v.seq).padStart(5, '0')}.log`);
    // Unique scaffold slot per visit so concurrent backdated visits at the same
    // location don't collide on the next-future-slot fallback (each gets its own
    // future 15-min slot; Phase 15 backdates it to the real date afterward).
    // 15-min steps keyed to seq → distinct, non-overlapping slots; bounded to a
    // ~26-day future window. In-flight seqs (≤concurrency apart) never collide.
    const scaffoldOffsetMin = ((v.seq % 2500) + 1) * 15;
    const child = spawn(
      'npx',
      [
        'tsx',
        SYNTH,
        scenarioFile,
        '--execute',
        '--practitioner',
        v.provider,
        '--intake',
        v.intakeMA,
        '--location',
        v.location,
      ],
      { env: { ...process.env, SYNTH_SCAFFOLD_OFFSET_MIN: String(scaffoldOffsetMin) } }
    );
    const chunks: string[] = [];
    child.stdout.on('data', (d) => chunks.push(d.toString()));
    child.stderr.on('data', (d) => chunks.push(d.toString()));
    child.on('close', (code) => {
      const out = chunks.join('');
      writeFileSync(logFile, out);
      if (code === 0) {
        recordOutcome(v.seq, 'done');
        console.log(
          `  ✓ seq ${v.seq} ${v.date} ${v.location.padEnd(11)} ${v.archetypeLabel} — ${v.firstName} ${v.lastName}`
        );
      } else {
        const lastErr =
          out
            .split('\n')
            .filter((l) => /error|aborted|failed/i.test(l))
            .slice(-1)[0] ?? `exit ${code}`;
        recordOutcome(v.seq, 'failed', lastErr);
        console.log(`  ✗ seq ${v.seq} FAILED (exit ${code}): ${lastErr.trim().slice(0, 160)}  [log: ${logFile}]`);
      }
      flushProgress();
      resolvePromise();
    });
  });
}

// Single-orchestrator lock. Two orchestrators running the same plan assign the
// same per-visit scaffold offset to the same seq → identical future slot time →
// create-appointment 4019 "slot unavailable". Refuse to start if another run
// holds the lock (stale locks > 6h are reclaimed).
const LOCK_PATH = resolve(HERE, '.run.lock');
function acquireLock(): void {
  if (existsSync(LOCK_PATH)) {
    try {
      const { pid, at } = JSON.parse(readFileSync(LOCK_PATH, 'utf-8')) as { pid: number; at: string };
      const ageMs = Date.now() - new Date(at).getTime();
      let alive = false;
      try {
        process.kill(pid, 0);
        alive = true;
      } catch {
        alive = false;
      }
      if (alive && ageMs < 6 * 3600 * 1000) {
        console.error(`Another run-population is active (pid ${pid}, started ${at}). Refusing to start.`);
        console.error(`If you're sure it's dead, remove ${LOCK_PATH}.`);
        process.exit(1);
      }
    } catch {
      /* malformed lock — reclaim */
    }
  }
  writeFileSync(LOCK_PATH, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
  const release = (): void => {
    try {
      const cur = JSON.parse(readFileSync(LOCK_PATH, 'utf-8')) as { pid: number };
      if (cur.pid === process.pid) unlinkSync(LOCK_PATH);
    } catch {
      /* ignore */
    }
  };
  process.on('exit', release);
  process.on('SIGINT', () => {
    release();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    release();
    process.exit(143);
  });
}

async function main(): Promise<void> {
  if (!DRY) acquireLock();
  const plan = JSON.parse(readFileSync(PLAN_PATH, 'utf-8')) as Plan;
  let visits = plan.visits;
  if (FROM) visits = visits.filter((v) => v.seq >= FROM);
  if (TO) visits = visits.filter((v) => v.seq <= TO);
  if (!REDO) visits = visits.filter((v) => progress[String(v.seq)]?.outcome !== 'done');
  if (LIMIT) visits = visits.slice(0, LIMIT);

  const total = plan.visits.length;
  const alreadyDone = Object.values(progress).filter((p) => p.outcome === 'done').length;
  console.log(`Plan: ${total} visits total; ${alreadyDone} already done.`);
  console.log(`This run: ${visits.length} visits (concurrency ${CONCURRENCY})${DRY ? ' [DRY]' : ''}.`);
  if (!visits.length) return;

  if (DRY) {
    for (const v of visits.slice(0, 20)) {
      console.log(
        `  seq ${v.seq} ${v.date} ${v.time} ${v.location.padEnd(11)} ${v.archetypeLabel.padEnd(30)} prov:${
          v.provider
        } ma:${v.intakeMA}`
      );
    }
    if (visits.length > 20) console.log(`  … and ${visits.length - 20} more`);
    return;
  }

  // Bounded-concurrency worker pool over a shared cursor.
  let cursor = 0;
  let completed = 0;
  const startedAt = Date.now();
  const worker = async (): Promise<void> => {
    while (cursor < visits.length) {
      const v = visits[cursor++];
      await runOne(v);
      completed++;
      if (completed % 25 === 0) {
        const rate = completed / ((Date.now() - startedAt) / 1000);
        const remaining = Math.round((visits.length - completed) / Math.max(rate, 1e-6));
        console.log(
          `  … ${completed}/${visits.length} done (${rate.toFixed(2)}/s, ~${Math.round(remaining / 60)} min left)`
        );
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()));
  flushProgress();

  const done = Object.values(progress).filter((p) => p.outcome === 'done').length;
  const failed = Object.values(progress).filter((p) => p.outcome === 'failed').length;
  console.log(`\nRun complete. Cumulative: ${done} done, ${failed} failed (of ${total}).`);
  if (failed) console.log(`Re-run to retry failures (they're not marked done). Logs in ${LOG_DIR}.`);
}

main().catch((e) => {
  flushProgress();
  console.error(e?.message ?? e);
  process.exit(1);
});
