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

// ── Radiology ────────────────────────────────────────────────────────────────
// The harness saves only a PRELIMINARY radiology report (radiology-order-list
// reports the order as status='preliminary'). A finalized visit should also have
// a FINAL report. radiology-save-final-report patches the existing preliminary
// DiagnosticReport → status='final' and creates a completed review Task, so the
// order moves preliminary → final → reviewed. We mirror the preliminary report's
// text into the final report (the synth narrative is already complete); if no
// preliminary text is recoverable we fall back to a generic normal impression.
//
// The precondition for save-final-report is simply that a preliminary
// DiagnosticReport exists for the SR (it patches that DR → final). We key off
// the order-list's `preliminaryReport` field rather than the coarse status enum:
// in synth data the ServiceRequest stays `active` (no PACS webhook fires to flip
// it to performed/completed), so the enum reports 'pending' even once a prelim
// report is attached. An order with a prelim report and no final report yet is
// finalizable; one that already has a final report is skipped.
const DEFAULT_FINAL_RADIOLOGY_REPORT = 'IMPRESSION: No acute abnormality identified. Findings reviewed and finalized.';

// Decode the base64 text/html report blob radiology-order-list returns back to
// plain text so we can re-submit it as the final report's body (save-final-report
// re-encodes it). The <br> the prelim save inserted for newlines is reversed.
function decodeRadiologyReport(b64: string | undefined): string | undefined {
  if (!b64) return undefined;
  try {
    return Buffer.from(b64, 'base64')
      .toString('utf-8')
      .replace(/<br\s*\/?>/gi, '\n');
  } catch {
    return undefined;
  }
}

// Finalize every preliminary radiology order on an encounter by saving a final
// report. Returns counts. Mirrors finalizeInHouseLabs' shape/usage.
export async function finalizeRadiology(
  ctx: FinalizeCtx,
  encounterId: string,
  execute: boolean
): Promise<{ finalized: number; skipped: number }> {
  const list = out(await zfetch(ctx, 'radiology-order-list', { encounterIds: [encounterId] }));
  const orders: any[] = list?.orders ?? (Array.isArray(list) ? list : []);
  let finalized = 0;
  let skipped = 0;
  for (const o of orders) {
    // Finalizable iff a preliminary report is attached and no final report yet.
    // (See note above on why we don't gate on the coarse status enum.)
    if (!o.preliminaryReport || o.finalReport) {
      skipped++;
      continue;
    }
    const report = decodeRadiologyReport(o.preliminaryReport) ?? DEFAULT_FINAL_RADIOLOGY_REPORT;
    if (!execute) {
      console.log(`    [dry] would finalize radiology ${o.serviceRequestId} (${o.studyType ?? ''})`);
      finalized++;
      continue;
    }
    await zfetch(ctx, 'radiology-save-final-report', { serviceRequestId: o.serviceRequestId, report });
    console.log(`    ✓ radiology ${o.studyType ?? o.serviceRequestId} → FINAL`);
    finalized++;
  }
  return { finalized, skipped };
}

// ── Medications & immunizations ──────────────────────────────────────────────
// The harness creates in-house medication + immunization orders and, for
// finalized visits, administers them at creation. For in-progress visits the
// orders are left PENDING (un-administered) — realistic — and the daily-census
// catch-up administers them when it later signs the visit. This finalizer
// discovers an encounter's pending orders and administers them, mirroring the
// harness's administer path so the two stay in sync.
//
// Discovery paths:
//   • medications  → get-medication-orders { searchBy:{field:'encounterId'} }
//                    (MedicationAdministration tagged in-person); pending orders
//                    have status 'pending'. Administer via
//                    create-update-medication-order { orderId, newStatus:'administered', orderData }.
//   • immunizations → get-immunization-orders { encounterIds:[...] }; pending
//                    orders have status 'pending'. Administer via
//                    administer-immunization-order (needs type + details +
//                    administrationDetails — synthesized from the order itself).

// Build the administrationDetails the administer-immunization-order zambda
// requires. The synth harness has no real lot/expiry/VIS/coding data, so we
// supply deterministic synthetic values (the EHR only requires them to be
// present + well-formed). cvx/mvx/ndc are placeholder codes; a real vaccine
// formulary would carry these on the Medication.
function syntheticImmunizationAdministrationDetails(): Record<string, unknown> {
  const now = new Date();
  const exp = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const dateOnly = (d: Date): string => d.toISOString().slice(0, 10);
  return {
    administeredDateTime: now.toISOString(),
    lot: 'SYNTH-LOT',
    expDate: dateOnly(exp),
    mvx: 'PMC', // generic manufacturer code (Sanofi Pasteur) — placeholder
    cvx: '998', // "no vaccine administered"/unspecified placeholder CVX
    ndc: '00000-0000-00',
    visGivenDate: dateOnly(now),
  };
}

// Administer every pending med + immunization order on an encounter. Returns
// counts split by kind so callers can log both.
export async function finalizeMedicationsAndImmunizations(
  ctx: FinalizeCtx,
  encounterId: string,
  execute: boolean
): Promise<{ medications: number; immunizations: number; skipped: number }> {
  let medications = 0;
  let immunizations = 0;
  let skipped = 0;

  // ── Medications ──
  const medList = out(
    await zfetch(ctx, 'get-medication-orders', { searchBy: { field: 'encounterId', value: encounterId } })
  );
  const medOrders: any[] = medList?.orders ?? [];
  for (const m of medOrders) {
    if (m.status !== 'pending') {
      skipped++;
      continue;
    }
    if (!execute) {
      console.log(`    [dry] would administer medication ${m.medicationName ?? m.id}`);
      medications++;
      continue;
    }
    // Administer transition: the zambda requires orderData with effectiveDateTime
    // for newStatus='administered'. On an UPDATE (orderId present) it does NOT
    // re-require the per-field create payload — it reuses the existing
    // MedicationAdministration's medication/route — so we send a minimal
    // orderData carrying only the encounter + administration time. Malformed
    // synth orders (placeholder medicationId / empty route) make the zambda's
    // medication-copy step throw; we catch per-order so one bad order doesn't
    // abort the rest of the encounter's finalization.
    try {
      await zfetch(ctx, 'create-update-medication-order', {
        orderId: m.id,
        newStatus: 'administered',
        orderData: {
          encounter: encounterId,
          encounterId,
          effectiveDateTime: m.effectiveDateTime || new Date().toISOString(),
        },
      });
      console.log(`    ✓ medication ${m.medicationName ?? m.id} → administered`);
      medications++;
    } catch (e: any) {
      console.log(`    ⚠ medication ${m.medicationName ?? m.id}: ${e?.message ?? e}`);
      skipped++;
    }
  }

  // ── Immunizations ──
  const immList = out(await zfetch(ctx, 'get-immunization-orders', { encounterIds: [encounterId] }));
  const immOrders: any[] = immList?.orders ?? [];
  for (const im of immOrders) {
    if (im.status !== 'pending') {
      skipped++;
      continue;
    }
    if (!execute) {
      console.log(`    [dry] would administer immunization ${im.details?.medication?.name ?? im.id}`);
      immunizations++;
      continue;
    }
    // administer-immunization-order re-runs updateOrderDetails, so it needs the
    // full order `details` back (the get-orders DTO carries them) plus the
    // synthetic administrationDetails the validator demands. Catch per-order so
    // a single malformed order doesn't abort the rest.
    try {
      await zfetch(ctx, 'administer-immunization-order', {
        orderId: im.id,
        type: 'administered',
        details: im.details,
        administrationDetails: syntheticImmunizationAdministrationDetails(),
      });
      console.log(`    ✓ immunization ${im.details?.medication?.name ?? im.id} → administered`);
      immunizations++;
    } catch (e: any) {
      console.log(`    ⚠ immunization ${im.details?.medication?.name ?? im.id}: ${e?.message ?? e}`);
      skipped++;
    }
  }

  return { medications, immunizations, skipped };
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
