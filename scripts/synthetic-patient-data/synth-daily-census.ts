// Daily synthetic census — keeps a lower environment's tracking board alive.
// Two phases, run in order:
//   CATCH-UP : prior-day synth-cron visits not yet signed → walk to completed,
//              sign-appointment, and re-backdate statusHistory to their own day
//              (so yesterday ends fully signed with realistic durations).
//   GENERATE : create N (default 40) NEW patients/visits dated today, in a
//              spread of in-progress statuses, so the board looks like a live
//              clinic. All tagged synth-cron + the run date.
//
// Idempotent: the generate phase no-ops if today already has >= N synth-cron
// visits; catch-up only ever touches synth-cron-tagged visits, never real ones.
// Refuses to run when ENVIRONMENT=production.
//
// Runs through a LOCAL zambda server (the wrapper boots an ephemeral one). Creds
// come from packages/zambdas/.env/<env>.json — never inline. Default env: demo.
//
//   npx env-cmd -f packages/zambdas/.env/demo.json npx tsx \
//     scripts/synthetic-patient-data/synth-daily-census.ts \
//     [--env demo] [--count 40] [--phase both|catchup|generate] [--dry] [--zambda-api URL]

import Oystehr from '@oystehr/sdk';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { DateTime } from 'luxon';
import { resolve } from 'path';
import {
  AuthoredResultsByTest,
  finalizeInHouseLabs,
  finalizeMedicationsAndImmunizations,
  finalizeRadiology,
  loadAuthoredResultsByPatient,
} from './finalize-visit-orders';
import {
  Archetype,
  ARCHETYPES,
  FIRST_NAMES_F,
  FIRST_NAMES_M,
  IN_PERSON_LOCATIONS,
  LAST_NAMES,
} from './population/archetypes';
import {
  OTTEHR_VISIT_STATUS_EXTENSION_URL as OTT_EXT_URL,
  STATUS_GAP_DISTRIBUTIONS as STATUS_GAP,
  SYNTH_CRON_RUN_DATE_SYSTEM as RUN_DATE_SYSTEM,
  SYNTH_CRON_SYSTEM as CRON_SYSTEM,
  VISIT_STATUS_ORDER,
} from './shared/constants';
import { withRetry } from './shared/retry';

const need = (n: string): string => {
  const v = process.env[n];
  if (!v) throw new Error('Missing ' + n);
  return v;
};
const arg = (name: string, dflt: string): string => {
  const i = process.argv.indexOf(name);
  return i !== -1 && i < process.argv.length - 1 ? process.argv[i + 1] : dflt;
};
const ENV = arg('--env', 'demo');
const COUNT = parseInt(arg('--count', '40'), 10);
const PHASE = arg('--phase', 'both'); // both | catchup | generate
const DRY = process.argv.includes('--dry');
const CONCURRENCY = parseInt(arg('--concurrency', '4'), 10);
const ZAMBDA_API = arg('--zambda-api', process.env.ZAMBDA_API || 'http://localhost:3000/local');
const HERE = __dirname;
const SYNTH = resolve(HERE, 'synthesize-visit.ts');
const EXAMPLES = resolve(HERE, 'examples');
const SCEN_DIR = resolve(HERE, '.census-scenarios');

const TZ = 'America/New_York';

// In-progress status mix for the day's N visits (proportions, normalized to COUNT).
// Spread across every board bucket so the in-office board looks like a real day:
// pre-booked (not arrived) → waiting room → exam rooms → discharged → a few done.
const STATUS_MIX: Array<{ status: string; weight: number }> = [
  { status: 'pending', weight: 6 }, // pre-booked — booked, not yet arrived
  { status: 'arrived', weight: 6 }, // waiting room — arrived
  { status: 'ready', weight: 4 }, // waiting room — ready for intake
  { status: 'intake', weight: 6 }, // in room with MA
  { status: 'ready for provider', weight: 6 },
  { status: 'provider', weight: 6 }, // with provider (exam)
  { status: 'discharged', weight: 4 }, // ready-for-review (unsigned)
  { status: 'completed', weight: 2 }, // finished + signed (off the board)
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

interface AuthCtx {
  at: string;
  o: Oystehr;
  projectId: string;
}

async function tokenAndClient(): Promise<AuthCtx> {
  const tk = await (
    await withRetry('mint M2M token', 3, () =>
      fetch(need('AUTH0_ENDPOINT'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.AUTH0_CLIENT,
          client_secret: process.env.AUTH0_SECRET,
          audience: process.env.AUTH0_AUDIENCE,
          grant_type: 'client_credentials',
        }),
      })
    )
  ).json();
  const at = (tk as any).access_token;
  if (!at) throw new Error(`M2M token mint failed: ${JSON.stringify(tk).slice(0, 200)}`);
  return {
    at,
    o: new Oystehr({
      accessToken: at,
      projectId: need('PROJECT_ID'),
      services: { projectApiUrl: need('PROJECT_API') },
    }),
    projectId: need('PROJECT_ID'),
  };
}

// Milliseconds until the JWT expires (Infinity when there's no decodable exp).
const jwtMsLeft = (jwt: string): number => {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf-8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 - Date.now() : Infinity;
  } catch {
    return Infinity;
  }
};

// Expiry-aware token access: the census used to mint ONE token for the whole
// run, which lapsed on long runs and turned every subsequent call into a 401/500
// cascade. Re-mint (and rebuild the Oystehr client) when <5 min of TTL remain.
// A single in-flight mint is shared so concurrent workers don't stampede.
let cachedAuth: AuthCtx | undefined;
let minting: Promise<AuthCtx> | undefined;
async function auth(): Promise<AuthCtx> {
  if (cachedAuth && jwtMsLeft(cachedAuth.at) > 5 * 60_000) return cachedAuth;
  if (!minting) {
    if (cachedAuth) console.log('[auth] M2M token expiring soon — re-minting');
    minting = tokenAndClient()
      .then((a) => {
        cachedAuth = a;
        return a;
      })
      .finally(() => {
        minting = undefined;
      });
  }
  return minting;
}
const hdr = (at: string, pid: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${at}`,
  'x-zapehr-project-id': pid,
});

// Rewrite Encounter.statusHistory with realistic gaps anchored to appointment.start.
function rebuildStatusHistory(
  appointmentStart: string,
  encounter: any,
  targetStatus: string,
  rng: () => number
): any[] {
  const existing = encounter.statusHistory ?? [];
  const byOtt = new Map<string, any>();
  for (const e of existing) {
    const code = e.extension?.find((x: any) => x.url === OTT_EXT_URL)?.valueCode;
    if (code) byOtt.set(code, e);
  }
  const targetIdx = VISIT_STATUS_ORDER.indexOf(targetStatus as any);
  if (targetIdx <= 0) return existing;
  const apptStart = DateTime.fromISO(appointmentStart);
  const gap = (st: string): number => {
    const r = STATUS_GAP[st];
    return r ? Math.round(r.min + rng() * (r.max - r.min)) : 5;
  };
  const stamped: Array<{ ott: string; start: DateTime }> = [];
  let cursor = apptStart.minus({ minutes: 30 });
  stamped.push({ ott: 'pending', start: cursor });
  for (let i = VISIT_STATUS_ORDER.indexOf('arrived'); i <= targetIdx; i++) {
    const ott = VISIT_STATUS_ORDER[i];
    cursor = ott === 'arrived' ? apptStart.plus({ minutes: gap('arrived') }) : cursor.plus({ minutes: gap(ott) });
    stamped.push({ ott, start: cursor });
  }
  return stamped.map((s, idx) => {
    const next = stamped[idx + 1];
    const orig = byOtt.get(s.ott);
    const period = { start: s.start.toUTC().toISO()!, ...(next ? { end: next.start.toUTC().toISO()! } : {}) };
    return orig
      ? { ...orig, period }
      : { status: 'in-progress', period, extension: [{ url: OTT_EXT_URL, valueCode: s.ott }] };
  });
}

// Resolve attending providers + intake staff from the TARGET ENV's actual
// employees (get-employees) — portable across projects, no hardcoded names. The
// harness --practitioner/--intake look these names up, so they must exist.
async function resolveStaff(at: string, projectId: string): Promise<{ providers: string[]; mas: string[] }> {
  const res = await fetch(`${ZAMBDA_API}/zambda/get-employees/execute`, {
    method: 'POST',
    headers: hdr(at, projectId),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`get-employees failed: ${res.status}`);
  const j: any = await res.json();
  // Keep only cleanly-splittable names: the harness --practitioner search splits
  // on whitespace (last token = family, rest = given), so a compound first or
  // last name (e.g. "De la Cruz") would search wrong. Require single-token first
  // AND last, and build the name from the employee's real firstName/lastName.
  const simple = (e: any): boolean =>
    /^\S+$/.test((e.firstName ?? '').trim()) && /^\S+$/.test((e.lastName ?? '').trim());
  const employees: any[] = (j.output?.employees ?? j.employees ?? []).filter(
    (e: any) => e.status === 'Active' && (e.profile || '').startsWith('Practitioner/') && simple(e)
  );
  const nameOf = (e: any): string => `${e.firstName} ${e.lastName}`.trim();
  const providers = employees
    .filter((e) => e.isProvider)
    .map(nameOf)
    .filter(Boolean);
  let mas = employees
    .filter((e) => !e.isProvider && !e.isCustomerSupport)
    .map(nameOf)
    .filter(Boolean);
  if (!mas.length) mas = providers; // small clinic: providers double as intake
  if (!providers.length) {
    throw new Error(
      `Environment '${ENV}' has no active provider employees. The census needs at least one. ` +
        `Run link-synth-staff-users.ts against ${ENV} (creates the synth staff) or add a provider in Admin → Employees.`
    );
  }
  return { providers, mas };
}

// ── CATCH-UP ──────────────────────────────────────────────────────────────────
async function catchUp(): Promise<void> {
  const { o } = await auth();
  const todayStart = DateTime.now().setZone(TZ).startOf('day').toUTC().toISO()!;
  // Prior-day synth-cron visits that still need signing. NOTE: an in-progress
  // visit at 'ready for provider' or beyond already carries Appointment.status
  // 'fulfilled' (Ottehr flips it once the patient reaches the exam stage) — so we
  // MUST include 'fulfilled' here or those visits are never caught up. The loop
  // skips any whose visit-status is already 'completed' (truly signed/done).
  const found = (
    await withRetry('catch-up Appointment search', 3, () =>
      o.fhir.search({
        resourceType: 'Appointment',
        params: [
          { name: '_tag', value: `${CRON_SYSTEM}|synth-cron` },
          { name: 'date', value: `lt${todayStart}` },
          { name: 'status', value: 'proposed,pending,booked,arrived,checked-in,waitlist,fulfilled' },
          { name: '_count', value: '300' },
        ],
      })
    )
  )
    .unbundle()
    .filter((r: any) => r.resourceType === 'Appointment') as any[];
  // Defensive dedupe by id: visits are independent across workers, but the same
  // appointment appearing twice (server-side search quirk) would race itself.
  const appts = [...new Map(found.map((a) => [a.id, a])).values()];
  const poolSize = Math.min(Math.max(1, CONCURRENCY), 8);
  console.log(
    `[catch-up] ${appts.length} prior-day synth-cron visits to sign (concurrency ${poolSize})${DRY ? '  [DRY]' : ''}`
  );
  let signed = 0;
  let failed = 0;
  let resulted = 0;
  let administered = 0;
  // Preload each prior day's scenario-authored lab results (approach A) ONCE,
  // before the pool starts — sync file reads, shared read-only by all workers.
  const authoredCache = new Map<string, Map<string, AuthoredResultsByTest>>();
  for (const appt of appts) {
    const runDate = (appt.meta?.tag ?? []).find((t: any) => t.system === RUN_DATE_SYSTEM)?.code;
    if (runDate && !authoredCache.has(runDate)) authoredCache.set(runDate, loadAuthoredResultsByPatient(runDate));
  }
  const nameKey = (s: string): string => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Sign one prior-day visit. All log lines are prefixed with the appointment id
  // so interleaved worker output stays readable.
  const signOne = async (appt: any): Promise<void> => {
    const { at, o, projectId } = await auth(); // re-mints when the token is near expiry
    const encs = (
      await withRetry(`${appt.id} Encounter search`, 3, () =>
        o.fhir.search({
          resourceType: 'Encounter',
          params: [{ name: 'appointment', value: `Appointment/${appt.id}` }],
        })
      )
    ).unbundle() as any[];
    const enc = encs.find((e: any) => e.resourceType === 'Encounter');
    if (!enc?.id) return;
    const curOtt =
      (enc.statusHistory ?? [])
        .map((e: any) => e.extension?.find((x: any) => x.url === OTT_EXT_URL)?.valueCode)
        .filter(Boolean)
        .slice(-1)[0] ?? 'pending';
    // 'fulfilled' appointments are in the query (in-progress exam-stage visits
    // carry that status) — but one already at visit-status 'completed' is signed
    // and done; skip so we don't re-process visits from a prior catch-up.
    if (curOtt === 'completed') return;
    if (DRY) {
      signed++;
      return;
    }
    // Jump to 'completed' via a single 'discharged' hop instead of walking every
    // intermediate status (~4-7 calls): change-in-person-visit-status does NO
    // adjacency validation (its helpers just map status → FHIR patches), and the
    // timestamps the walk would stamp are DISCARDED — rebuildStatusHistory below
    // rewrites the whole statusHistory anchored to the visit's own day. The one
    // hop we keep is 'discharged', so the discharged→scheduled-outreach side
    // effect still fires for catch-up visits (parity with the old full walk).
    // The only other status side effect — 'ready for provider' completing an
    // in-progress AI questionnaire — is a no-op for synth visits (no AI
    // interview), so skipping that hop loses nothing.
    const fromIdx = Math.max(VISIT_STATUS_ORDER.indexOf(curOtt as any), 0);
    for (const target of ['discharged', 'completed']) {
      if (VISIT_STATUS_ORDER.indexOf(target as any) <= fromIdx) continue;
      const res = await withRetry(`${appt.id} status→${target}`, 3, () =>
        fetch(`${ZAMBDA_API}/zambda/change-in-person-visit-status/execute`, {
          method: 'POST',
          headers: hdr(at, projectId),
          body: JSON.stringify({ encounterId: enc.id, updatedStatus: target }),
        })
      );
      if (!res.ok) throw new Error(`status→${target}: ${res.status} ${(await res.text()).slice(0, 100)}`);
    }
    // Re-backdate statusHistory to the visit's own day (the walk stamped now()).
    const fresh: any = await withRetry(`${appt.id} Encounter get`, 3, () =>
      o.fhir.get({ resourceType: 'Encounter', id: enc.id })
    );
    if (appt.start) {
      const rng = mulberry32(
        [...`${appt.id}-catchup`].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261)
      );
      const newHistory = rebuildStatusHistory(appt.start, fresh, 'completed', rng);
      await withRetry(`${appt.id} statusHistory patch`, 3, () =>
        o.fhir.patch({
          resourceType: 'Encounter',
          id: enc.id,
          operations: [{ op: 'replace', path: '/statusHistory', value: newHistory }],
        })
      );
    }
    // Finalize this visit's pending in-house lab orders BEFORE signing (the
    // visit just reached 'completed', so results are now "back"). Values come
    // from that day's persisted scenario files (approach A); the finalizer
    // falls back to normal in-range values when a scenario file is missing.
    try {
      const runDate = (appt.meta?.tag ?? []).find((t: any) => t.system === RUN_DATE_SYSTEM)?.code;
      if (runDate) {
        const pid = (fresh.subject?.reference ?? enc.subject?.reference)?.split('/')[1];
        const patient: any = pid
          ? await withRetry(`${appt.id} Patient get`, 3, () => o.fhir.get({ resourceType: 'Patient', id: pid }))
          : undefined;
        const key = patient ? `${nameKey(patient.name?.[0]?.given?.[0])} ${nameKey(patient.name?.[0]?.family)}` : '';
        const authored = authoredCache.get(runDate)?.get(key) ?? {};
        const fz = await finalizeInHouseLabs(
          { zambdaApi: ZAMBDA_API, headers: hdr(at, projectId) },
          enc.id,
          authored,
          true
        );
        resulted += fz.finalized;
      }
    } catch (e: any) {
      console.log(`  ⚠ ${appt.id}: lab finalize: ${e?.message ?? e}`);
    }
    // Finalize radiology orders (preliminary → final) the same way — the visit
    // just reached 'completed', so the final read is now "back".
    try {
      const fz = await finalizeRadiology({ zambdaApi: ZAMBDA_API, headers: hdr(at, projectId) }, enc.id, true);
      resulted += fz.finalized;
    } catch (e: any) {
      console.log(`  ⚠ ${appt.id}: radiology finalize: ${e?.message ?? e}`);
    }
    // Administer any pending in-house medication + immunization orders left
    // un-administered while the visit was in progress.
    try {
      const fz = await finalizeMedicationsAndImmunizations(
        { zambdaApi: ZAMBDA_API, headers: hdr(at, projectId) },
        enc.id,
        true
      );
      administered += fz.medications + fz.immunizations;
    } catch (e: any) {
      console.log(`  ⚠ ${appt.id}: med/imm finalize: ${e?.message ?? e}`);
    }
    // Sign.
    const sres = await withRetry(`${appt.id} sign`, 3, () =>
      fetch(`${ZAMBDA_API}/zambda/sign-appointment/execute`, {
        method: 'POST',
        headers: hdr(at, projectId),
        body: JSON.stringify({
          appointmentId: appt.id,
          encounterId: enc.id,
          timezone: TZ,
          supervisorApprovalEnabled: false,
        }),
      })
    );
    if (!sres.ok) throw new Error(`sign: ${sres.status} ${(await sres.text()).slice(0, 100)}`);
    signed++;
    console.log(`  ✓ ${appt.id}: signed (was '${curOtt}')`);
  };

  // Bounded worker pool — same idiom as generate(). Visits are independent:
  // change-status's version/ifMatch guard only conflicts on the SAME encounter,
  // which the id-dedupe above makes impossible across workers.
  let idx = 0;
  const worker = async (): Promise<void> => {
    while (idx < appts.length) {
      const appt = appts[idx++];
      try {
        await signOne(appt);
      } catch (e: any) {
        failed++;
        console.log(`  ✗ ${appt.id}: ${e?.message ?? e}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(poolSize, Math.max(appts.length, 1)) }, () => worker()));
  console.log(
    `[catch-up] signed ${signed}` +
      `${failed ? `, FAILED ${failed}` : ''}` +
      `${resulted ? `, finalized ${resulted} lab/radiology order(s)` : ''}` +
      `${administered ? `, administered ${administered} med/immunization order(s)` : ''}.`
  );
}

// ── GENERATE ──────────────────────────────────────────────────────────────────
function weighted<T extends { weight: number }>(pool: T[], rng: () => number): T {
  const total = pool.reduce((s, a) => s + a.weight, 0);
  let r = rng() * total;
  for (const a of pool) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return pool[pool.length - 1];
}
function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}
function statusSequence(rng: () => number): string[] {
  // Expand STATUS_MIX into COUNT statuses, shuffled.
  const seq: string[] = [];
  const total = STATUS_MIX.reduce((s, m) => s + m.weight, 0);
  for (const m of STATUS_MIX) seq.push(...Array(Math.max(1, Math.round((m.weight / total) * COUNT))).fill(m.status));
  while (seq.length < COUNT) seq.push('provider');
  seq.length = COUNT;
  for (let i = seq.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [seq[i], seq[j]] = [seq[j], seq[i]];
  }
  return seq;
}
function dobForAge(age: number, rng: () => number): string {
  const d = DateTime.now().minus({ years: age, days: Math.floor(rng() * 365) });
  return d.toFormat('yyyy-MM-dd');
}

// Status-aware appointment timing, anchored to NOW (not a fixed 07:30–17:00
// stagger). EVERY visit — including pre-booked ('pending') — is created as a
// recent walk-in so the harness's create-appointment always succeeds (a future
// scheduled slot is rejected by create-appointment's cadence/capacity guard with
// 4019 "slot unavailable" unless it exactly matches an available grid slot). The
// 'pending' visit is then PATCHED to status=booked with a future start (see the
// worker), giving a real pre-booked visit with a full chart underneath — so when
// the next-day catch-up advances it to signed, it's a complete visit, not empty.
const PAST_MINUTES_AGO: Record<string, [number, number]> = {
  pending: [5, 30], // created as a recent walk-in, then patched to booked + future
  arrived: [5, 45],
  ready: [5, 45],
  intake: [30, 120],
  'ready for provider': [30, 120],
  provider: [30, 120],
  discharged: [90, 180],
  completed: [120, 300],
};
function appointmentTimeForStatus(status: string, now: DateTime, rng: () => number): { date: string; time: string } {
  const [lo, hi] = PAST_MINUTES_AGO[status] ?? [10, 60];
  // The harness parses scenario.visit.{date,time} as UTC (computeSlotStartISO:
  // `${date}T${time}:00.000Z`; intendedHistoricalStart: zone 'utc'). Emit the UTC
  // components of our target instant so the appointment lands at exactly the
  // intended moment regardless of the machine/clinic timezone.
  const u = now.minus({ minutes: lo + Math.floor(rng() * (hi - lo)) }).toUTC();
  return { date: u.toFormat('yyyy-MM-dd'), time: u.toFormat('HH:mm') };
}

// Future start for a pre-booked (pending) appointment — later today so it stays
// on today's board. We PATCH the appointment to this instead of booking through
// create-appointment (which rejects off-grid/unavailable future slots).
function prebookFutureStart(now: DateTime, rng: () => number): DateTime {
  const cap = now.set({ hour: 20, minute: 0, second: 0, millisecond: 0 });
  const ahead = now.plus({ minutes: 60 + Math.floor(rng() * 360) }); // +1..7h
  // Late run with no daytime left → just a bit ahead of now (still today).
  return ahead > cap ? now.plus({ minutes: 15 + Math.floor(rng() * 45) }) : ahead;
}

async function generate(staff: { providers: string[]; mas: string[] }): Promise<void> {
  const { o } = await auth();
  const today = DateTime.now().setZone(TZ).toFormat('yyyy-MM-dd');
  // Idempotency: already ran today?
  const existing = (await o.fhir.search({
    resourceType: 'Appointment',
    params: [
      { name: '_tag', value: `${RUN_DATE_SYSTEM}|${today}` },
      { name: '_count', value: '1' },
      { name: '_total', value: 'accurate' },
    ],
  })) as any;
  const already = existing.total ?? existing.unbundle().length;
  if (already >= COUNT) {
    console.log(`[generate] already ${already} synth-cron visits for ${today} — skipping.`);
    return;
  }

  const rng = mulberry32(
    [...`census-${today}`].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261)
  );
  const statuses = statusSequence(rng);
  const now = DateTime.now().setZone(TZ);
  if (!existsSync(SCEN_DIR)) mkdirSync(SCEN_DIR, { recursive: true });

  const usedNames = new Set<string>();
  interface Visit {
    scenarioFile: string;
    targetStatus: string;
    provider: string;
    intakeMA: string;
    location: string;
    label: string;
    prebookStartISO?: string; // set for 'pending' → patch appt to booked + this start
  }
  const visits: Visit[] = [];
  for (let i = 0; i < COUNT; i++) {
    const arch: Archetype = weighted(ARCHETYPES, rng);
    const sex: 'male' | 'female' =
      arch.sex === 'any' ? (rng() < 0.5 ? 'male' : 'female') : (arch.sex as 'male' | 'female');
    const age = arch.ageMin + Math.floor(rng() * (arch.ageMax - arch.ageMin + 1));
    let first = '';
    let last = '';
    let key = '';
    do {
      first = pick(sex === 'female' ? FIRST_NAMES_F : FIRST_NAMES_M, rng);
      last = pick(LAST_NAMES, rng);
      key = `${first}|${last}`;
    } while (usedNames.has(key));
    usedNames.add(key);
    const location = IN_PERSON_LOCATIONS[i % IN_PERSON_LOCATIONS.length];
    const { date: apptDate, time } = appointmentTimeForStatus(statuses[i], now, rng);

    const base = JSON.parse(readFileSync(resolve(EXAMPLES, arch.file), 'utf-8'));
    base.label = `${first} ${last} — ${arch.label} (census ${today})`;
    base.patient = {
      ...base.patient,
      firstName: first,
      lastName: last,
      dateOfBirth: dobForAge(age, rng),
      sex,
      email: `${slug(first)}.${slug(last)}.${today}.${i}@example.com`,
    };
    base.visit = { ...base.visit, date: apptDate, time, locationName: location, targetStatus: statuses[i] };
    // complete:true so the harness ALWAYS runs the status walk (phase 13) up to
    // targetStatus. Do NOT tie this to status — the harness early-returns the
    // entire walk when signOff.complete===false, which would strand every
    // non-completed visit in the waiting room. Final signing is gated separately
    // by targetStatus!=='completed' in phase 14, so only 'completed' visits sign.
    base.signOff = { ...(base.signOff ?? {}), complete: true };
    const scenarioFile = resolve(SCEN_DIR, `census-${today}-${String(i).padStart(3, '0')}.json`);
    writeFileSync(scenarioFile, JSON.stringify(base, null, 2));
    visits.push({
      scenarioFile,
      targetStatus: statuses[i],
      // Rotate among the env's actual provider/intake employees for even spread.
      provider: staff.providers[i % staff.providers.length],
      intakeMA: staff.mas[i % staff.mas.length],
      location,
      label: base.label,
      prebookStartISO: statuses[i] === 'pending' ? prebookFutureStart(now, rng).toUTC().toISO()! : undefined,
    });
  }

  console.log(
    `[generate] ${COUNT} visits for ${today} (statuses: ${STATUS_MIX.map(
      (m) => m.status + '×' + statuses.filter((s) => s === m.status).length
    ).join(', ')})${DRY ? '  [DRY]' : ''}`
  );
  if (DRY) return;

  let idx = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    while (idx < visits.length) {
      const v = visits[idx++];
      await new Promise<void>((res) => {
        const child = spawn(
          'npx',
          [
            'tsx',
            SYNTH,
            v.scenarioFile,
            '--execute',
            '--practitioner',
            v.provider,
            '--intake',
            v.intakeMA,
            '--location',
            v.location,
          ],
          {
            env: { ...process.env, SYNTH_SCAFFOLD_OFFSET_MIN: String((idx % 200) * 7 + 3), ZAMBDA_API },
          }
        );
        const chunks: string[] = [];
        child.stdout.on('data', (d) => chunks.push(d.toString()));
        child.stderr.on('data', (d) => chunks.push(d.toString()));
        child.on('close', async (code) => {
          const out = chunks.join('');
          if (code === 0) {
            // Tag the created appointment + encounter as synth-cron + run-date.
            // Re-resolve auth here: on a long generate run the initial token can
            // lapse mid-phase; auth() re-mints (and rebuilds the client) if so.
            const { o: oNow } = await auth();
            const apptId = out.match(/Appointment:\s+([a-f0-9-]+)/)?.[1];
            const encId = out.match(/Encounter:\s+([a-f0-9-]+)/)?.[1];
            for (const [rt, id] of [
              ['Appointment', apptId],
              ['Encounter', encId],
            ] as const) {
              if (!id) continue;
              try {
                const r: any = await oNow.fhir.get({ resourceType: rt, id });
                r.meta = {
                  ...(r.meta || {}),
                  tag: [
                    ...(r.meta?.tag || []),
                    { system: CRON_SYSTEM, code: 'synth-cron' },
                    { system: RUN_DATE_SYSTEM, code: today },
                  ],
                };
                // Pre-booked: the harness created this as a recent walk-in
                // (arrived). Flip it to a real pre-booked visit — Appointment
                // booked at a future start, Encounter back to planned with no
                // arrival history — leaving the full chart intact for the
                // next-day catch-up to sign into a complete visit.
                if (v.prebookStartISO) {
                  if (rt === 'Appointment') {
                    r.status = 'booked';
                    r.start = v.prebookStartISO;
                    r.end = DateTime.fromISO(v.prebookStartISO).plus({ minutes: 15 }).toUTC().toISO();
                    // Created as a walk-in (the only path that books); re-label the
                    // FHIR appointmentType as prebook so the board shows
                    // "Scheduled" + the scheduled time, not "On Demand". The
                    // board/parser read appointmentType.text.
                    r.appointmentType = { ...(r.appointmentType || {}), text: 'prebook' };
                  } else {
                    r.status = 'planned';
                    delete r.statusHistory;
                  }
                }
                await oNow.fhir.update(r);
              } catch {
                /* non-fatal */
              }
            }
            done++;
            console.log(`  ✓ ${v.targetStatus.padEnd(20)} ${v.label}`);
          } else {
            const err =
              out
                .split('\n')
                .filter((l) => /error|aborted|failed/i.test(l))
                .slice(-1)[0] ?? `exit ${code}`;
            console.log(`  ✗ FAILED ${v.label}: ${err.trim().slice(0, 120)}`);
          }
          res();
        });
      });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()));
  console.log(`[generate] created ${done}/${COUNT}.`);
}

async function main(): Promise<void> {
  console.log(`synth-daily-census — env=${ENV}, count=${COUNT}, phase=${PHASE}, zambda=${ZAMBDA_API}`);
  const { at, o, projectId } = await auth();
  // Refuse production.
  if ((process.env.ENVIRONMENT || '').toLowerCase() === 'production')
    throw new Error('Refusing to run against production.');

  // ── Env readiness (runs every time, so the script adapts to any project) ──
  // FATAL: in-person Locations + their Schedules, and ≥1 provider — without these
  // no visit can be booked. NON-FATAL (warn): progress-note templates — missing
  // ones make those archetypes' notes thin (the harness skips meds/labs/payers it
  // can't resolve, so those are degrade-not-fail).
  // Resolve each required Location by an exact NAME search — never a capped list fetch.
  // A project with >100 Locations (e.g. a local project full of integration-test
  // Locations) would otherwise hide the real "Los Angeles"/"New York" past the first
  // page and falsely report them missing. FHIR `name` is a starts-with match, so filter
  // to the exact, active Location.
  for (const ln of IN_PERSON_LOCATIONS) {
    const loc = (
      await o.fhir.search({
        resourceType: 'Location',
        params: [
          { name: 'name', value: ln },
          { name: '_count', value: '20' },
        ],
      })
    )
      .unbundle()
      .find((l: any) => l.name === ln && l.status !== 'inactive') as any;
    if (!loc?.id) {
      throw new Error(`Environment '${ENV}' is missing required in-person location: ${ln}.`);
    }
    const sched = (
      await o.fhir.search({
        resourceType: 'Schedule',
        params: [
          { name: 'actor', value: `Location/${loc.id}` },
          { name: '_count', value: '1' },
        ],
      })
    ).unbundle();
    if (!sched.length)
      throw new Error(`Environment '${ENV}': Location "${ln}" has no Schedule — slot booking would fail.`);
  }
  // Resolve attending/intake staff from THIS env's actual employees (portable).
  const staff = await resolveStaff(at, projectId);
  console.log(
    `[ready] env '${ENV}': locations + schedules OK, ${staff.providers.length} provider(s), ${staff.mas.length} intake employee(s).`
  );
  // Templates warning (non-fatal). Paginate Lists filtering by the global-template code system.
  const TEMPLATE_SYS = [
    'https://fhir.ottehr.com/CodeSystem/global-template-in-person',
    'https://fhir.ottehr.com/CodeSystem/global-template-telemed',
  ];
  let tmplCount = 0;
  for (let off = 0; ; off += 500) {
    const ls = (
      await o.fhir.search({
        resourceType: 'List',
        params: [
          { name: '_count', value: '500' },
          { name: '_offset', value: String(off) },
        ],
      })
    ).unbundle() as any[];
    if (!ls.length) break;
    tmplCount += ls.filter((l: any) => (l.code?.coding ?? []).some((c: any) => TEMPLATE_SYS.includes(c.system))).length;
    if (ls.length < 500) break;
  }
  if (tmplCount === 0) {
    console.warn(
      `⚠ env '${ENV}' has no progress-note templates — templated archetypes will produce thin notes. Seed with copy-templates.ts.`
    );
  } else {
    console.log(`[ready] ${tmplCount} progress-note template(s) present.`);
  }

  if (PHASE === 'both' || PHASE === 'catchup') await catchUp();
  if (PHASE === 'both' || PHASE === 'generate') await generate(staff);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
