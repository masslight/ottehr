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
  Archetype,
  ARCHETYPES,
  FIRST_NAMES_F,
  FIRST_NAMES_M,
  IN_PERSON_LOCATIONS,
  LAST_NAMES,
  MAS_BY_LOCATION,
  PROVIDERS_BY_LOCATION,
} from './population/archetypes';

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

const CRON_SYSTEM = 'https://fhir.ottehr.com/sid/synth-cron';
const RUN_DATE_SYSTEM = 'https://fhir.ottehr.com/sid/synth-cron-run-date';
const TZ = 'America/New_York';

// In-progress status mix for the day's N visits (proportions, normalized to COUNT).
const STATUS_MIX: Array<{ status: string; weight: number }> = [
  { status: 'arrived', weight: 6 },
  { status: 'intake', weight: 8 },
  { status: 'ready for provider', weight: 8 },
  { status: 'provider', weight: 8 },
  { status: 'discharged', weight: 6 }, // ready-for-review (unsigned)
  { status: 'completed', weight: 4 }, // finished + signed
];

const VISIT_STATUS_ORDER = [
  'pending',
  'arrived',
  'ready',
  'intake',
  'ready for provider',
  'provider',
  'discharged',
  'completed',
] as const;
const STATUS_GAP: Record<string, { min: number; max: number }> = {
  arrived: { min: -5, max: 20 },
  ready: { min: 1, max: 8 },
  intake: { min: 5, max: 25 },
  'ready for provider': { min: 8, max: 15 },
  provider: { min: 3, max: 30 },
  discharged: { min: 12, max: 35 },
  completed: { min: 2, max: 15 },
};
const OTT_EXT_URL = 'https://extensions.fhir.zapehr.com/visit-status';

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

async function tokenAndClient(): Promise<{ at: string; o: Oystehr; projectId: string }> {
  const tk = await (
    await fetch(need('AUTH0_ENDPOINT'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.AUTH0_CLIENT,
        client_secret: process.env.AUTH0_SECRET,
        audience: process.env.AUTH0_AUDIENCE,
        grant_type: 'client_credentials',
      }),
    })
  ).json();
  const at = (tk as any).access_token;
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

// ── CATCH-UP ──────────────────────────────────────────────────────────────────
async function catchUp(at: string, o: Oystehr, projectId: string): Promise<void> {
  const todayStart = DateTime.now().setZone(TZ).startOf('day').toUTC().toISO()!;
  // synth-cron visits dated before today, not yet fulfilled.
  const appts = (
    await o.fhir.search({
      resourceType: 'Appointment',
      params: [
        { name: '_tag', value: `${CRON_SYSTEM}|synth-cron` },
        { name: 'date', value: `lt${todayStart}` },
        { name: 'status', value: 'proposed,pending,booked,arrived,checked-in,waitlist' },
        { name: '_count', value: '300' },
      ],
    })
  )
    .unbundle()
    .filter((r: any) => r.resourceType === 'Appointment') as any[];
  console.log(`[catch-up] ${appts.length} prior-day synth-cron visits to sign${DRY ? '  [DRY]' : ''}`);
  let signed = 0;
  for (const appt of appts) {
    try {
      const encs = (
        await o.fhir.search({
          resourceType: 'Encounter',
          params: [{ name: 'appointment', value: `Appointment/${appt.id}` }],
        })
      ).unbundle() as any[];
      const enc = encs.find((e: any) => e.resourceType === 'Encounter');
      if (!enc?.id) continue;
      if (DRY) {
        signed++;
        continue;
      }
      // Walk remaining statuses to completed.
      const curOtt =
        (enc.statusHistory ?? [])
          .map((e: any) => e.extension?.find((x: any) => x.url === OTT_EXT_URL)?.valueCode)
          .filter(Boolean)
          .slice(-1)[0] ?? 'pending';
      const fromIdx = Math.max(VISIT_STATUS_ORDER.indexOf(curOtt as any), 0);
      for (let i = fromIdx + 1; i < VISIT_STATUS_ORDER.length; i++) {
        const res = await fetch(`${ZAMBDA_API}/zambda/change-in-person-visit-status/execute`, {
          method: 'POST',
          headers: hdr(at, projectId),
          body: JSON.stringify({ encounterId: enc.id, updatedStatus: VISIT_STATUS_ORDER[i] }),
        });
        if (!res.ok)
          throw new Error(`status→${VISIT_STATUS_ORDER[i]}: ${res.status} ${(await res.text()).slice(0, 100)}`);
      }
      // Re-backdate statusHistory to the visit's own day (the walk stamped now()).
      const fresh: any = await o.fhir.get({ resourceType: 'Encounter', id: enc.id });
      if (appt.start) {
        const rng = mulberry32(
          [...`${appt.id}-catchup`].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261)
        );
        const newHistory = rebuildStatusHistory(appt.start, fresh, 'completed', rng);
        await o.fhir.patch({
          resourceType: 'Encounter',
          id: enc.id,
          operations: [{ op: 'replace', path: '/statusHistory', value: newHistory }],
        });
      }
      // Sign.
      const sres = await fetch(`${ZAMBDA_API}/zambda/sign-appointment/execute`, {
        method: 'POST',
        headers: hdr(at, projectId),
        body: JSON.stringify({
          appointmentId: appt.id,
          encounterId: enc.id,
          timezone: TZ,
          supervisorApprovalEnabled: false,
        }),
      });
      if (!sres.ok) throw new Error(`sign: ${sres.status} ${(await sres.text()).slice(0, 100)}`);
      signed++;
    } catch (e: any) {
      console.log(`  ✗ ${appt.id}: ${e?.message ?? e}`);
    }
  }
  console.log(`[catch-up] signed ${signed}.`);
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

async function generate(at: string, o: Oystehr): Promise<void> {
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
  // Stagger arrival times across business hours 07:30–17:00.
  const startMin = 7 * 60 + 30;
  const span = 9.5 * 60;
  if (!existsSync(SCEN_DIR)) mkdirSync(SCEN_DIR, { recursive: true });

  const usedNames = new Set<string>();
  interface Visit {
    scenarioFile: string;
    targetStatus: string;
    provider: string;
    intakeMA: string;
    location: string;
    label: string;
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
    const minute = Math.round(startMin + (i / COUNT) * span);
    const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

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
    base.visit = { ...base.visit, date: today, time, locationName: location, targetStatus: statuses[i] };
    base.signOff = { ...(base.signOff ?? {}), complete: statuses[i] === 'completed' };
    const scenarioFile = resolve(SCEN_DIR, `census-${today}-${String(i).padStart(3, '0')}.json`);
    writeFileSync(scenarioFile, JSON.stringify(base, null, 2));
    visits.push({
      scenarioFile,
      targetStatus: statuses[i],
      provider: pick(PROVIDERS_BY_LOCATION[location], rng),
      intakeMA: pick(MAS_BY_LOCATION[location], rng),
      location,
      label: base.label,
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
            const apptId = out.match(/Appointment:\s+([a-f0-9-]+)/)?.[1];
            const encId = out.match(/Encounter:\s+([a-f0-9-]+)/)?.[1];
            for (const [rt, id] of [
              ['Appointment', apptId],
              ['Encounter', encId],
            ] as const) {
              if (!id) continue;
              try {
                const r: any = await o.fhir.get({ resourceType: rt, id });
                r.meta = {
                  ...(r.meta || {}),
                  tag: [
                    ...(r.meta?.tag || []),
                    { system: CRON_SYSTEM, code: 'synth-cron' },
                    { system: RUN_DATE_SYSTEM, code: today },
                  ],
                };
                await o.fhir.update(r);
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
  const { at, o, projectId } = await tokenAndClient();
  // Refuse production.
  if ((process.env.ENVIRONMENT || '').toLowerCase() === 'production')
    throw new Error('Refusing to run against production.');

  // Demo-readiness: the harness needs the in-person locations + provider/MA staff.
  const locs = (
    await o.fhir.search({ resourceType: 'Location', params: [{ name: '_count', value: '100' }] })
  ).unbundle() as any[];
  const locNames = new Set(locs.map((l: any) => l.name));
  const missingLocs = IN_PERSON_LOCATIONS.filter((n) => !locNames.has(n));
  if (missingLocs.length) {
    throw new Error(
      `Environment '${ENV}' is missing required in-person location(s): ${missingLocs.join(', ')}. ` +
        `The census needs these Locations (with Schedules) to book visits.`
    );
  }
  const wantStaff = [...Object.values(PROVIDERS_BY_LOCATION).flat(), ...Object.values(MAS_BY_LOCATION).flat()];
  const presentStaff = new Set(
    (
      (
        await o.fhir.search({ resourceType: 'Practitioner', params: [{ name: '_count', value: '300' }] })
      ).unbundle() as any[]
    ).map((p: any) => `${p.name?.[0]?.given?.join(' ')} ${p.name?.[0]?.family}`.trim())
  );
  const missingStaff = wantStaff.filter((n) => !presentStaff.has(n));
  if (missingStaff.length > wantStaff.length / 2) {
    console.warn(
      `⚠ Environment '${ENV}' is missing most synth staff (e.g. ${missingStaff.slice(0, 3).join(', ')}). ` +
        `Run link-synth-staff-users.ts against ${ENV} to create them, or visits fall back to whatever ` +
        `role-assigned provider exists. Continuing.`
    );
  }
  if (PHASE === 'both' || PHASE === 'catchup') await catchUp(at, o, projectId);
  if (PHASE === 'both' || PHASE === 'generate') await generate(at, o);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
