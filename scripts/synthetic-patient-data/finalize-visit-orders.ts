// Finalizes a visit's pending in-house lab orders — the step the synth harness
// stops short of (it orders + collects the specimen but never enters results).
// Maps each scenario-authored result (analyte → value) to the test's
// ObservationDefinition ids and submits them via handle-in-house-lab-results so
// the order moves COLLECTED → FINAL (the zambda derives normal/abnormal from the
// definition's ranges). When no authored value is available it falls back to a
// normal in-range value from the ObservationDefinition.
//
// Used by the daily-census catch-up (to result yesterday's visits as it signs
// them) and runnable standalone to backfill a census day:
//   npx env-cmd -f packages/zambdas/.env/demo.json npx tsx \
//     scripts/synthetic-patient-data/finalize-visit-orders.ts --census-day 2026-06-20 [--execute] [--zambda-api URL]

import Oystehr from '@oystehr/sdk';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { DateTime } from 'luxon';
import { resolve } from 'path';

const need = (n: string): string => {
  const v = process.env[n];
  if (!v) throw new Error('Missing ' + n);
  return v;
};
const arg = (name: string, dflt: string): string => {
  const i = process.argv.indexOf(name);
  return i !== -1 && i < process.argv.length - 1 ? process.argv[i + 1] : dflt;
};

const TZ = 'America/New_York';
const SCEN_DIR = resolve(__dirname, '.census-scenarios');
const RUN_DATE_SYSTEM = 'https://fhir.ottehr.com/sid/synth-cron-run-date';
const OTT_EXT_URL = 'https://extensions.fhir.zapehr.com/visit-status';
// Results only "come back" once the visit is far enough along; in-progress
// visits keep pending orders (realistic). --all overrides for backfills.
const FINALIZED_STATUSES = new Set(['discharged', 'completed']);
// Strip parentheticals before alphanumerics so a scenario test name ("Urinalysis")
// matches the catalog/order name ("Urinalysis (UA)") — mirrors the harness's fuzzy
// catalog match. Harmless for analyte names (which carry no parentheticals).
const norm = (s: string): string =>
  (s ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '');
const latestVisitStatus = (enc: any): string =>
  (enc.statusHistory ?? [])
    .map((h: any) => h.extension?.find((x: any) => x.url === OTT_EXT_URL)?.valueCode)
    .filter(Boolean)
    .slice(-1)[0] ?? '';

export interface AuthoredResult {
  analyte: string;
  value: string | number;
  flag?: string;
}
export type AuthoredResultsByTest = Record<string, AuthoredResult[]>; // keyed by normalized testName

export interface FinalizeCtx {
  zambdaApi: string;
  headers: Record<string, string>;
}

const zfetch = async (ctx: FinalizeCtx, route: string, body: unknown): Promise<any> => {
  const res = await fetch(`${ctx.zambdaApi}/zambda/${route}/execute`, {
    method: 'POST',
    headers: ctx.headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${route} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
};
const out = (j: any): any => j?.output ?? j;

// A normal in-range value for a component, used when the scenario didn't author
// one. Quantity → midpoint of normalRange; CodeableConcept → first (normal)
// valueSet code; string → "Normal".
function normalValueFor(component: any): string | undefined {
  if (component.dataType === 'Quantity' && component.normalRange) {
    const { low, high } = component.normalRange;
    if (typeof low === 'number' && typeof high === 'number') return String(Math.round(((low + high) / 2) * 10) / 10);
  }
  if (component.dataType === 'CodeableConcept') {
    const normal = (component.valueSet ?? []).find(
      (v: any) => !(component.abnormalValues ?? []).some((a: any) => a.code === v.code)
    );
    if (normal) return normal.code;
  }
  if (component.dataType === 'string') return 'Normal';
  return undefined;
}

// Build the ResultEntryInput { [observationDefinitionId]: valueString } for one
// order from its components and the scenario's authored results.
function buildLabResultData(components: any[], authored: AuthoredResult[] | undefined): Record<string, string> {
  const data: Record<string, string> = {};
  for (const c of components) {
    if (!c?.observationDefinitionId) continue;
    const match = (authored ?? []).find((r) => norm(r.analyte) === norm(c.componentName));
    let value: string | undefined;
    if (match != null) {
      // CodeableConcept authored as a display ("negative") → resolve to its code.
      if (c.dataType === 'CodeableConcept') {
        const opt = [...(c.valueSet ?? []), ...(c.abnormalValues ?? [])].find(
          (v: any) => norm(v.code) === norm(String(match.value)) || norm(v.display) === norm(String(match.value))
        );
        value = opt?.code ?? String(match.value);
      } else {
        value = String(match.value);
      }
    } else {
      value = normalValueFor(c);
    }
    if (value !== undefined) data[c.observationDefinitionId] = value;
  }
  return data;
}

// Finalize every non-FINAL in-house lab order on an encounter. Returns counts.
export async function finalizeInHouseLabs(
  ctx: FinalizeCtx,
  encounterId: string,
  resultsByTest: AuthoredResultsByTest,
  execute: boolean
): Promise<{ finalized: number; skipped: number }> {
  const list = out(
    await zfetch(ctx, 'get-in-house-orders', { searchBy: { field: 'encounterId', value: encounterId } })
  );
  const orders: any[] = Array.isArray(list) ? list : list?.data ?? [];
  let finalized = 0;
  let skipped = 0;
  for (const o of orders) {
    if (o.status === 'FINAL') {
      skipped++;
      continue;
    }
    // Detail query carries labDetails.components (the ObservationDefinition ids).
    const detailRes = out(
      await zfetch(ctx, 'get-in-house-orders', { searchBy: { field: 'serviceRequestId', value: o.serviceRequestId } })
    );
    const detail = (Array.isArray(detailRes) ? detailRes[0] : detailRes?.data?.[0]) ?? detailRes;
    const components: any[] = detail?.labDetails?.components?.components ?? [];
    const authored = resultsByTest[norm(o.testItemName)];
    const data = buildLabResultData(components, authored);
    if (!Object.keys(data).length) {
      console.log(`    ⚠ ${o.testItemName}: no resolvable components — skipping`);
      skipped++;
      continue;
    }
    if (!execute) {
      console.log(`    [dry] would finalize ${o.testItemName} (${Object.keys(data).length} component(s))`);
      finalized++;
      continue;
    }
    // ORDERED (specimen not yet collected) must be collected before results.
    if (o.status === 'ORDERED') {
      await zfetch(ctx, 'collect-in-house-lab-specimen', {
        encounterId,
        serviceRequestId: o.serviceRequestId,
        data: {
          specimen: {
            source: 'specimen',
            collectedBy: { id: '', name: 'Synthesizer' },
            collectionDate: new Date().toISOString(),
          },
        },
      }).catch((e) => console.log(`    ⚠ collect ${o.testItemName}: ${e.message}`));
    }
    await zfetch(ctx, 'handle-in-house-lab-results', { serviceRequestId: o.serviceRequestId, data });
    console.log(`    ✓ ${o.testItemName} → FINAL`);
    finalized++;
  }
  return { finalized, skipped };
}

// ── Scenario-file sourcing (approach A) ──────────────────────────────────────
// Read a census day's persisted scenario files and index authored lab results
// by patient name, so the catch-up can recover diagnosis-coherent values.
export function loadAuthoredResultsByPatient(date: string): Map<string, AuthoredResultsByTest> {
  const byPatient = new Map<string, AuthoredResultsByTest>();
  if (!existsSync(SCEN_DIR)) return byPatient;
  for (const f of readdirSync(SCEN_DIR)) {
    if (!f.startsWith(`census-${date}-`) || !f.endsWith('.json')) continue;
    try {
      const s = JSON.parse(readFileSync(resolve(SCEN_DIR, f), 'utf-8'));
      const labs = s.modules?.inHouseLabs ?? [];
      if (!labs.length) continue;
      const byTest: AuthoredResultsByTest = {};
      for (const lab of labs) if (lab.results) byTest[norm(lab.testName)] = lab.results;
      const key = `${norm(s.patient?.firstName)} ${norm(s.patient?.lastName)}`;
      byPatient.set(key, byTest);
    } catch {
      /* skip unreadable scenario */
    }
  }
  return byPatient;
}

// ── CLI: backfill a whole census day ─────────────────────────────────────────
async function main(): Promise<void> {
  const ZAMBDA_API = arg('--zambda-api', process.env.ZAMBDA_API || 'http://localhost:3000/local');
  const date = arg('--census-day', DateTime.now().setZone(TZ).toFormat('yyyy-MM-dd'));
  const execute = process.argv.includes('--execute');
  const finalizeAll = process.argv.includes('--all'); // finalize regardless of visit status

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
  const projectId = need('PROJECT_ID');
  const o = new Oystehr({
    accessToken: (tk as any).access_token,
    projectId,
    services: { projectApiUrl: need('PROJECT_API') },
  });
  const ctx: FinalizeCtx = {
    zambdaApi: ZAMBDA_API,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${(tk as any).access_token}`,
      'x-zapehr-project-id': projectId,
    },
  };

  const resultsByPatient = loadAuthoredResultsByPatient(date);
  console.log(
    `Finalizing in-house labs for census ${date} (${execute ? 'EXECUTE' : 'DRY'}); scenario files for ${
      resultsByPatient.size
    } patient(s) with labs.`
  );

  const all = (
    await o.fhir.search({
      resourceType: 'Appointment',
      params: [
        { name: '_tag', value: `${RUN_DATE_SYSTEM}|${date}` },
        { name: '_count', value: '300' },
        { name: '_revinclude', value: 'Encounter:appointment' },
        { name: '_include', value: 'Appointment:patient' },
      ],
    })
  ).unbundle();
  const encs = all.filter((r: any) => r.resourceType === 'Encounter') as any[];
  const patients = new Map(all.filter((r: any) => r.resourceType === 'Patient').map((p: any) => [p.id, p]));

  let tot = 0;
  let skippedInProgress = 0;
  for (const e of encs) {
    const status = latestVisitStatus(e);
    if (!finalizeAll && !FINALIZED_STATUSES.has(status)) {
      skippedInProgress++;
      continue; // in-progress visit → orders stay pending on purpose
    }
    const pid = e.subject?.reference?.split('/')[1];
    const p: any = patients.get(pid);
    const name = p ? `${norm(p.name?.[0]?.given?.[0])} ${norm(p.name?.[0]?.family)}` : '';
    const authored = resultsByPatient.get(name) ?? {};
    try {
      const { finalized } = await finalizeInHouseLabs(ctx, e.id, authored, execute);
      if (finalized) {
        console.log(`  ${p?.name?.[0]?.given?.[0] ?? '?'} ${p?.name?.[0]?.family ?? ''}: ${finalized} lab(s)`);
        tot += finalized;
      }
    } catch (err: any) {
      console.log(`  ✗ encounter ${e.id}: ${err.message}`);
    }
  }
  console.log(
    `\nDone — ${tot} lab order(s) ${execute ? 'finalized' : 'would be finalized'} for ${date}` +
      `${finalizeAll ? '' : ` (skipped ${skippedInProgress} in-progress visit(s) — orders stay pending)`}.`
  );
}

if (process.argv[1] && process.argv[1].includes('finalize-visit-orders')) {
  main().catch((e) => {
    console.error(e?.message ?? e);
    process.exit(1);
  });
}
