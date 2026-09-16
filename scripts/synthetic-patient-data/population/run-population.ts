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

import Oystehr from '@oystehr/sdk';
import { execFileSync, spawn } from 'child_process';
import type { Appointment, Basic } from 'fhir/r4b';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { arg, argInt, flag } from '../shared/cli';
import {
  SYNTH_POPULATION_MANIFEST_CODE,
  SYNTH_POPULATION_MANIFEST_EXT_URL,
  SYNTH_POPULATION_MANIFEST_SYSTEM,
  SYNTH_POPULATION_SEQ_PREFIX,
  SYNTH_POPULATION_SYSTEM,
} from '../shared/constants';
import { absolutizeFixtures } from '../shared/fixtures';
import { type HarnessCommand, prepareHarnessCommand } from '../shared/harness-bundle';
import { createOystehrFromEnv, searchAllPages } from '../shared/oystehr-client';
import { withRetry } from '../shared/retry';
import { ensureSynthM2MInProcess } from '../shared/synth-m2m';

const HERE = __dirname;
const EXAMPLES = resolve(HERE, '..', 'examples');
const PLAN_SCRIPT = resolve(HERE, 'plan-population.ts');
const PLAN_PATH = resolve(arg('--plan', resolve(HERE, 'population-plan.json')));
const PROGRESS_PATH = resolve(arg('--progress', resolve(HERE, 'population-progress.json')));
const SCEN_DIR = resolve(HERE, '.scenarios');
const LOG_DIR = resolve(HERE, '.logs');

// Plan params — used to create the manifest on the FIRST run. On a resume the
// manifest's stored params win (see readOrCreateManifest), so these are only the
// "new population" defaults.
const SEED = argInt('--seed', { default: 42 });
const PATIENTS = argInt('--patients', { default: 2000, min: 1 });
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

// ── FHIR-native run state ─────────────────────────────────────────────────────
// The population's durable state lives IN THE TARGET PROJECT, not a local file or
// CI cache: a singleton `Basic` manifest (plan params + status) and a `seq-<N>`
// meta.tag on every seeded Appointment. Resume = "which seqs are already tagged".
// This mirrors how the daily census derives idempotency from FHIR tags, and means
// re-dispatching the GitHub Action just works with no cache to persist/expire.

// Refreshable M2M client (only used for manifest + per-visit tagging; the harness
// children mint their own tokens). Re-mint every ~50 min so a multi-hour run
// doesn't lapse the token mid-flight.
let clientCache: Oystehr | undefined;
let clientMintedAt = 0;
async function popClient(): Promise<Oystehr> {
  if (!clientCache || Date.now() - clientMintedAt > 50 * 60_000) {
    clientCache = await createOystehrFromEnv();
    clientMintedAt = Date.now();
  }
  return clientCache;
}

interface ManifestState {
  seed: number;
  patients: number;
  todayAnchor: string; // YYYY-MM-DD — pins the plan's date/DOB anchor so resume regenerates it identically
}

async function findManifest(o: Oystehr): Promise<Basic | undefined> {
  const results = (
    await o.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [
        { name: 'code', value: `${SYNTH_POPULATION_MANIFEST_SYSTEM}|${SYNTH_POPULATION_MANIFEST_CODE}` },
        { name: '_count', value: '2' },
      ],
    })
  ).unbundle();
  if (results.length > 1)
    console.warn(`⚠ ${results.length} population manifests found; using the first (${results[0].id}).`);
  return results[0];
}

// Read the singleton manifest, or create it (pinning todayAnchor = today) on the
// first run. On a resume the STORED params win — a mismatched --seed/--patients is
// a warning, not a new plan, so seq→patient stays stable. `readOnly` (dry-run)
// never writes: it falls back to a today-anchored ephemeral plan.
async function readOrCreateManifest(
  o: Oystehr,
  want: { seed: number; patients: number },
  readOnly: boolean
): Promise<ManifestState> {
  const existing = await findManifest(o);
  const raw = existing?.extension?.find((e) => e.url === SYNTH_POPULATION_MANIFEST_EXT_URL)?.valueString;
  if (raw) {
    const state = JSON.parse(raw) as ManifestState;
    if (state.seed !== want.seed || state.patients !== want.patients) {
      console.warn(
        `⚠ existing population manifest is seed=${state.seed} patients=${state.patients}; ignoring CLI ` +
          `seed=${want.seed} patients=${want.patients} and RESUMING the existing plan. To start a different ` +
          `population, clean it up first (cleanup-synth-patient --all) and delete Basic/${existing?.id}.`
      );
    }
    return state;
  }
  const state: ManifestState = {
    seed: want.seed,
    patients: want.patients,
    todayAnchor: new Date().toISOString().slice(0, 10),
  };
  if (!readOnly) {
    await o.fhir.create<Basic>({
      resourceType: 'Basic',
      code: {
        coding: [{ system: SYNTH_POPULATION_MANIFEST_SYSTEM, code: SYNTH_POPULATION_MANIFEST_CODE }],
        text: 'Synthetic population run manifest',
      },
      meta: { tag: [{ system: SYNTH_POPULATION_SYSTEM, code: 'manifest' }] },
      extension: [
        {
          url: SYNTH_POPULATION_MANIFEST_EXT_URL,
          valueString: JSON.stringify({ ...state, startedAt: new Date().toISOString(), status: 'in-progress' }),
        },
      ],
    });
  }
  return state;
}

async function updateManifest(o: Oystehr, patch: Record<string, unknown>): Promise<void> {
  const existing = await findManifest(o);
  if (!existing?.id) return;
  const raw = existing.extension?.find((e) => e.url === SYNTH_POPULATION_MANIFEST_EXT_URL)?.valueString;
  const cur = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  await o.fhir.update<Basic>(
    {
      ...existing,
      resourceType: 'Basic',
      id: existing.id,
      extension: [
        {
          url: SYNTH_POPULATION_MANIFEST_EXT_URL,
          valueString: JSON.stringify({ ...cur, ...patch, lastUpdatedAt: new Date().toISOString() }),
        },
      ],
    },
    existing.meta?.versionId ? { optimisticLockingVersionId: existing.meta.versionId } : undefined
  );
}

// "Which plan seqs already have a seeded Appointment" — the resume set, derived
// straight from FHIR tags. No local ledger to drift or lose.
async function loadDoneSeqs(o: Oystehr): Promise<Set<number>> {
  const appts = await searchAllPages<Appointment>(o, 'Appointment', [
    { name: '_tag', value: `${SYNTH_POPULATION_SYSTEM}|` },
  ]);
  const seqs = new Set<number>();
  for (const a of appts) {
    for (const t of a.meta?.tag ?? []) {
      if (t.system === SYNTH_POPULATION_SYSTEM && t.code?.startsWith(SYNTH_POPULATION_SEQ_PREFIX)) {
        const n = Number(t.code.slice(SYNTH_POPULATION_SEQ_PREFIX.length));
        if (Number.isFinite(n)) seqs.add(n);
      }
    }
  }
  return seqs;
}

// Tag a just-seeded Appointment with its plan seq — this is what makes the visit
// count as "done" on the next run. Retried on transient failures; a hard failure
// is loud (that seq would otherwise re-run and create a duplicate visit).
async function tagAppointmentDone(appointmentId: string, seq: number): Promise<void> {
  await withRetry(`tag population seq ${seq}`, 3, async () => {
    const o = await popClient();
    const appt = await o.fhir.get<Appointment>({ resourceType: 'Appointment', id: appointmentId });
    const tag = (appt.meta?.tag ?? []).filter((t) => t.system !== SYNTH_POPULATION_SYSTEM);
    tag.push({ system: SYNTH_POPULATION_SYSTEM, code: `${SYNTH_POPULATION_SEQ_PREFIX}${seq}` });
    const op = appt.meta?.tag ? 'replace' : appt.meta ? 'add' : 'add';
    const path = appt.meta ? '/meta/tag' : '/meta';
    const value = appt.meta ? tag : { tag };
    await o.fhir.patch<Appointment>({
      resourceType: 'Appointment',
      id: appointmentId,
      operations: [{ op, path, value }],
    });
  });
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

  // Fixtures (ID/insurance card images) are relative to the example file; this temp
  // scenario lives in a deeper dir, so absolutize them or the harness skips uploads.
  absolutizeFixtures(base, EXAMPLES);

  if (!existsSync(SCEN_DIR)) mkdirSync(SCEN_DIR, { recursive: true });
  const file = resolve(SCEN_DIR, `seq-${String(v.seq).padStart(5, '0')}.json`);
  writeFileSync(file, JSON.stringify(base, null, 2));
  return file;
}

// Parse the harness's machine-readable SYNTH_RESULT line (stable contract) to get
// the created Appointment id for tagging. {} if absent.
function parseSynthResult(out: string): { appointmentId?: string } {
  const m = out.match(/^SYNTH_RESULT (\{.*\})\s*$/m);
  if (!m) return {};
  try {
    const r = JSON.parse(m[1]) as Record<string, string | null>;
    return { appointmentId: r.appointmentId ?? undefined };
  } catch {
    return {};
  }
}

// Spawn command for the per-visit harness. Set once in main() before the pool
// starts: a pre-built `node <bundle.js>` (fast path) or `npx tsx` (fallback).
let harness: HarnessCommand;

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
      harness.command,
      [
        ...harness.argsPrefix,
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
    let settled = false;
    child.stdout.on('data', (d) => chunks.push(d.toString()));
    child.stderr.on('data', (d) => chunks.push(d.toString()));
    // A spawn-level failure (ENOENT / EMFILE under concurrency) emits 'error' with
    // NO 'close' — without this listener Node throws an uncaught exception that
    // aborts the whole resumable run and strands the worker promise. Record it as a
    // retryable failure and resolve so the pool continues and a re-run retries it.
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      recordOutcome(v.seq, 'failed', `spawn error: ${err instanceof Error ? err.message : String(err)}`);
      console.log(`  ✗ seq ${v.seq} spawn error: ${err instanceof Error ? err.message : err}  [log: ${logFile}]`);
      flushProgress();
      resolvePromise();
    });
    child.on('close', async (code) => {
      if (settled) return;
      settled = true;
      try {
        const out = chunks.join('');
        writeFileSync(logFile, out);
        if (code === 0) {
          // Durable "done" = the Appointment carries its seq tag in FHIR. Do this
          // before recording local progress; a tag failure is loud (that seq would
          // otherwise re-run and create a duplicate visit on resume).
          const appointmentId = parseSynthResult(out).appointmentId;
          if (appointmentId) {
            try {
              await tagAppointmentDone(appointmentId, v.seq);
            } catch (err) {
              console.log(
                `  ⚠ seq ${v.seq}: created but FAILED to tag Appointment/${appointmentId} ` +
                  `(${err instanceof Error ? err.message : err}) — may re-run/duplicate on resume`
              );
            }
          } else {
            console.log(
              `  ⚠ seq ${v.seq}: created but no Appointment id in harness output — untagged (may re-run/duplicate on resume)`
            );
          }
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
          // Inline the error context (from "Pipeline aborted" onward — includes the
          // zambda response BODY, e.g. a 400's reason) so the failure is diagnosable
          // straight from the job log, without the per-visit artifact.
          const lines = out.split('\n');
          const from = lines.findIndex((l) => /Pipeline aborted|Fatal error/i.test(l));
          const ctxLines = (from >= 0 ? lines.slice(from) : lines.slice(-25)).slice(0, 40);
          for (const l of ctxLines) console.log(`    │ ${l}`);
        }
        flushProgress();
      } finally {
        resolvePromise();
      }
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

  // Authenticate as a dedicated Practitioner-profile M2M (provisioned in-process
  // under admin creds; nothing written to disk) so the harness's save-chart-data
  // resolves the caller to a Practitioner. No-op without admin creds. Skipped on
  // --dry (dry only reads FHIR, which the default M2M can do).
  if (!DRY) await ensureSynthM2MInProcess({ name: 'Synth Pipeline (population)' });

  // Durable run state lives in the target project: a Basic manifest pins the plan
  // params (seed/patients/todayAnchor), so we regenerate the EXACT same plan every
  // run, and per-Appointment `seq-<N>` tags tell us what's already seeded. No local
  // progress file or CI cache to persist/expire.
  const o = await popClient();
  const manifest = await readOrCreateManifest(o, { seed: SEED, patients: PATIENTS }, DRY);
  console.log(
    `Population manifest: seed=${manifest.seed} patients=${manifest.patients} anchor=${manifest.todayAnchor}` +
      `${DRY ? ' [DRY — not persisted]' : ''}`
  );
  console.log('Regenerating plan from manifest params …');
  execFileSync(
    'npx',
    [
      'tsx',
      PLAN_SCRIPT,
      '--seed',
      String(manifest.seed),
      '--patients',
      String(manifest.patients),
      '--today',
      manifest.todayAnchor,
      '--out',
      PLAN_PATH,
    ],
    { stdio: 'inherit' }
  );
  const plan = JSON.parse(readFileSync(PLAN_PATH, 'utf-8')) as Plan;

  // Resume set = seqs already tagged on seeded Appointments (from FHIR).
  const doneSeqs = REDO ? new Set<number>() : await loadDoneSeqs(o);

  let visits = plan.visits;
  if (FROM) visits = visits.filter((v) => v.seq >= FROM);
  if (TO) visits = visits.filter((v) => v.seq <= TO);
  if (!REDO) visits = visits.filter((v) => !doneSeqs.has(v.seq));
  if (LIMIT) visits = visits.slice(0, LIMIT);

  const total = plan.visits.length;
  console.log(`Plan: ${total} visits total; ${doneSeqs.size} already seeded (from FHIR tags).`);
  console.log(`This run: ${visits.length} visits (concurrency ${CONCURRENCY})${DRY ? ' [DRY]' : ''}.`);
  if (!visits.length) {
    if (!DRY && doneSeqs.size >= total) await updateManifest(o, { status: 'complete', doneCount: doneSeqs.size });
    return;
  }

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

  // Pre-build the harness ONCE (per-visit spawns then run the plain-JS bundle
  // under `node` instead of re-transpiling the harness via tsx on every spawn).
  // Never throws — falls back internally to `npx tsx` on build failure.
  harness = await prepareHarnessCommand();
  try {
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
  } finally {
    harness.cleanup();
  }

  // Re-read the durable done-set from FHIR for an accurate cumulative count, and
  // record it on the manifest (status flips to 'complete' once everything's seeded).
  const doneNow = await loadDoneSeqs(o);
  const failed = Object.values(progress).filter((p) => p.outcome === 'failed').length;
  await updateManifest(o, {
    status: doneNow.size >= total ? 'complete' : 'in-progress',
    doneCount: doneNow.size,
    lastRunFailed: failed,
  });
  console.log(`\nRun complete. Seeded (FHIR): ${doneNow.size}/${total}. Failed this run: ${failed}.`);
  if (doneNow.size < total)
    console.log(`Re-run to continue — resume is derived from FHIR tags (no cache needed). Logs in ${LOG_DIR}.`);
}

main().catch((e) => {
  flushProgress();
  console.error(e?.message ?? e);
  process.exit(1);
});
