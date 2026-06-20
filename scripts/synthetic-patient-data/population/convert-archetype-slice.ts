// Updates a slice of existing visits' progress notes IN PLACE to the 30 new
// archetypes — adding clinical-complaint variety WITHOUT regenerating (keeps the
// same patient, appointment, date, slot, location, staff, and signed status).
//
// Per visit: clear the encounter's provider chart (old dx / CC / HPI / exam /
// ROS / MDM / eRx / procedures / lab+imaging orders), repoint the reason, and
// rewrite from a new age/sex-compatible archetype via save-chart-data + eRx.
// Vitals, PMH, allergies, home meds, and the appointment/encounter shells stay.
// Idempotent: tags converted encounters and skips them on re-run.
//
// Known limit: the rewrite goes through save-chart-data + eRx (dx/CC/exam/ROS/
// MDM/Rx/instructions). It does NOT recreate the separate lab/imaging/procedure
// ORDER flows, so a converted visit reads correct but carries no discrete order.
//
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx convert-archetype-slice.ts --dry [--target 800]
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx convert-archetype-slice.ts --limit 5   # validate
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx convert-archetype-slice.ts --target 800 --concurrency 6

import Oystehr from '@oystehr/sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ARCHETYPES } from './archetypes';

const need = (n: string): string => {
  const v = process.env[n];
  if (!v) throw new Error('Missing ' + n);
  return v;
};
const arg = (name: string, dflt: string): string => {
  const i = process.argv.indexOf(name);
  return i !== -1 && i < process.argv.length - 1 ? process.argv[i + 1] : dflt;
};
const DRY = process.argv.includes('--dry');
const REDO = process.argv.includes('--redo');
const TARGET = parseInt(arg('--target', '800'), 10);
const LIMIT = parseInt(arg('--limit', '0'), 10);
const CONCURRENCY = parseInt(arg('--concurrency', '6'), 10);
const SEED = parseInt(arg('--seed', '99'), 10);
const EXAMPLES = resolve(__dirname, '..', 'examples');
const ZAMBDA = process.env.ZAMBDA_API || 'http://localhost:3000/local';
const DRUG_SYS = 'https://terminology.fhir.oystehr.com/CodeSystem/medispan-dispensable-drug-id';
const CONVERTED_SYS = 'https://fhir.ottehr.com/sid/synth-converted';

// Only the NEW (gen-*) archetypes are conversion targets.
const NEW_ARCH = ARCHETYPES.filter((a) => a.file.startsWith('gen-'));

// Tags to clear per encounter (provider chart). KEEP everything else
// (vitals, em-code, medical-condition, allergies, current-medication,
// surgical-history, hospitalization, etc.).
const CLEAR: Array<{ rt: string; tags: string[] }> = [
  { rt: 'Condition', tags: ['diagnosis', 'chief-complaint', 'history-of-present-illness', 'mechanism-of-injury'] },
  { rt: 'Observation', tags: ['exam-observation-field', 'ros-observation-field'] },
  { rt: 'ClinicalImpression', tags: ['medical-decision'] },
  { rt: 'MedicationRequest', tags: ['erx-medication'] },
  { rt: 'Communication', tags: ['patient-instruction'] },
  { rt: 'Procedure', tags: ['cpt-code', 'procedure'] },
  {
    rt: 'ServiceRequest',
    tags: ['in-house-lab', 'radiology', 'external-lab', 'disposition-follow-up', 'sub-follow-up'],
  },
  { rt: 'DiagnosticReport', tags: ['in-house-lab', 'radiology'] },
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
const rng = mulberry32(SEED);

function ageOf(birthDate: string): number {
  const d = new Date(birthDate);
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}
function pickArchetype(age: number, sex: string): (typeof NEW_ARCH)[number] | null {
  const ok = NEW_ARCH.filter((a) => age >= a.ageMin && age <= a.ageMax && (a.sex === 'any' || a.sex === sex));
  if (!ok.length) return null;
  const total = ok.reduce((s, a) => s + a.weight, 0);
  let r = rng() * total;
  for (const a of ok) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return ok[ok.length - 1];
}

const scenarioCache: Record<string, any> = {};
const loadScenario = (file: string): any =>
  (scenarioCache[file] ??= JSON.parse(readFileSync(resolve(EXAMPLES, file), 'utf-8')));

async function main(): Promise<void> {
  const tok = await (
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
  const at = (tok as any).access_token;
  const o = new Oystehr({
    accessToken: at,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });

  // --only: re-process a specific set of encounter IDs (with REDO semantics).
  const onlyIds = arg('--only', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (onlyIds.length) {
    const slice2: Array<{ encId: string; patientRef: string; arch: (typeof NEW_ARCH)[number] }> = [];
    for (const encId of onlyIds) {
      const enc: any = await o.fhir.get({ resourceType: 'Encounter', id: encId }).catch(() => null);
      const patientRef = enc?.subject?.reference;
      const pid = patientRef?.split('/')?.[1];
      const p: any = pid ? await o.fhir.get({ resourceType: 'Patient', id: pid }).catch(() => null) : null;
      if (!enc || !p?.birthDate) continue;
      const arch = pickArchetype(ageOf(p.birthDate), p.gender || 'female');
      if (arch) slice2.push({ encId, patientRef, arch });
    }
    await convert(o, at, slice2, true);
    return;
  }

  // Candidate encounters = those with a primary diagnosis, not already converted.
  const cands = new Map<string, { code: string; patientRef?: string }>();
  let offset = 0;
  for (;;) {
    const b = await o.fhir.search({
      resourceType: 'Condition',
      params: [
        { name: '_tag', value: 'diagnosis' },
        { name: '_count', value: '1000' },
        { name: '_offset', value: String(offset) },
      ],
    });
    const cs = b.unbundle().filter((r: any) => r.resourceType === 'Condition') as any[];
    if (!cs.length) break;
    for (const c of cs) {
      const encId = c.encounter?.reference?.split('/')?.[1];
      if (encId && !cands.has(encId))
        cands.set(encId, { code: c.code?.coding?.[0]?.code, patientRef: c.subject?.reference });
    }
    offset += cs.length;
    if (cs.length < 1000) break;
  }

  // Resolve patient age/sex (batched).
  const patientIds = [
    ...new Set([...cands.values()].map((v) => v.patientRef?.split('/')?.[1]).filter(Boolean) as string[]),
  ];
  const patMeta: Record<string, { age: number; sex: string }> = {};
  for (let i = 0; i < patientIds.length; i += 100) {
    const ids = patientIds.slice(i, i + 100);
    const b = await o.fhir.search({
      resourceType: 'Patient',
      params: [
        { name: '_id', value: ids.join(',') },
        { name: '_count', value: '100' },
      ],
    });
    for (const p of b.unbundle() as any[])
      if (p.id && p.birthDate) patMeta[p.id] = { age: ageOf(p.birthDate), sex: p.gender || 'female' };
  }

  // Build + shuffle the eligible list, assign an archetype, take TARGET.
  const eligible: Array<{ encId: string; patientRef: string; arch: (typeof NEW_ARCH)[number] }> = [];
  for (const [encId, { patientRef }] of cands) {
    const pid = patientRef?.split('/')?.[1];
    const meta = pid ? patMeta[pid] : undefined;
    if (!meta || !patientRef) continue;
    const arch = pickArchetype(meta.age, meta.sex);
    if (arch) eligible.push({ encId, patientRef, arch });
  }
  // Seeded shuffle
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  const slice = eligible.slice(0, LIMIT || TARGET);

  // Distribution preview
  const byArch: Record<string, number> = {};
  for (const e of slice) byArch[e.arch.label] = (byArch[e.arch.label] ?? 0) + 1;
  console.log(`Eligible: ${eligible.length} | converting: ${slice.length}${DRY ? '  [DRY]' : ''}`);
  console.log('New complaint distribution:');
  for (const [l, n] of Object.entries(byArch).sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(n).padStart(4)}  ${l}`);
  if (DRY) return;
  await convert(o, at, slice, REDO);
}

type SliceItem = { encId: string; patientRef: string; arch: (typeof NEW_ARCH)[number] };
async function convert(o: Oystehr, at: string, slice: SliceItem[], redo: boolean): Promise<void> {
  let done = 0;
  let skipped = 0;
  let idx = 0;
  const worker = async (): Promise<void> => {
    while (idx < slice.length) {
      const { encId, patientRef, arch } = slice[idx++];
      try {
        const enc: any = await o.fhir.get({ resourceType: 'Encounter', id: encId });
        if (!redo && (enc.meta?.tag || []).some((t: any) => t.system === CONVERTED_SYS)) {
          skipped++;
          continue;
        }
        // 1. Clear old provider chart. The marker may live in the tag CODE
        // (e.g. 'diagnosis') or the tag SYSTEM (exam/ROS use system
        // 'exam-observation-field' with code = field name), so match either.
        for (const { rt, tags } of CLEAR) {
          const rs = (
            await o.fhir.search({
              resourceType: rt as any,
              params: [
                { name: 'encounter', value: `Encounter/${encId}` },
                { name: '_count', value: '300' },
              ],
            })
          ).unbundle() as any[];
          for (const r of rs) {
            const codes = (r.meta?.tag || []).map((t: any) => t.code);
            const systems = (r.meta?.tag || []).map((t: any) => t.system || '');
            const hit = tags.some((t) => codes.includes(t) || systems.some((s: string) => s.includes(t)));
            if (r.id && hit) await o.fhir.delete({ resourceType: rt as any, id: r.id }).catch(() => {});
          }
        }
        // 2. Rewrite from the new archetype
        const sc = loadScenario(arch.file);
        const provRef = enc.participant
          ?.map((p: any) => p.individual?.reference)
          .find((r: string) => r?.startsWith('Practitioner/'));
        const body: Record<string, unknown> = {
          encounterId: encId,
          chiefComplaint: { text: sc.visit.reasonForVisit },
          diagnosis: sc.diagnoses,
          examObservations: sc.exam,
          rosObservations: (sc.reviewOfSystems || []).map((r: any) => ({ field: r.field, value: true })),
          ...(sc.medicalDecision ? { medicalDecision: { text: sc.medicalDecision } } : {}),
          ...(sc.disposition?.note
            ? { instructions: [{ text: sc.disposition.note, title: 'Discharge instructions' }] }
            : {}),
        };
        const res = await fetch(`${ZAMBDA}/zambda/save-chart-data/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${at}`,
            'x-zapehr-project-id': need('PROJECT_ID'),
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          console.log(`  ✗ ${encId}: save-chart-data ${res.status} ${(await res.text()).slice(0, 120)}`);
          continue;
        }
        // 3. Prescriptions (eRx)
        for (const rx of sc.prescriptions || []) {
          await o.fhir.create({
            resourceType: 'MedicationRequest',
            status: 'active',
            intent: 'order',
            meta: { tag: [{ code: 'erx-medication' }] },
            subject: { reference: patientRef },
            encounter: { reference: `Encounter/${encId}` },
            ...(enc.period?.start ? { authoredOn: enc.period.start } : {}),
            ...(provRef ? { requester: { reference: provRef } } : {}),
            medicationCodeableConcept: { coding: [{ system: DRUG_SYS, display: rx.name }], text: rx.name },
            dosageInstruction: [{ text: rx.sig, patientInstruction: rx.sig }],
          } as any);
        }
        // 4. Repoint reason + tag converted. RE-FETCH first so we don't clobber
        // the Encounter.diagnosis link save-chart-data just wrote.
        const fresh: any = await o.fhir.get({ resourceType: 'Encounter', id: encId });
        fresh.reasonCode = [{ text: sc.visit.reasonForVisit }];
        const existingTags = (fresh.meta?.tag || []).filter((t: any) => t.system !== CONVERTED_SYS);
        fresh.meta = { ...(fresh.meta || {}), tag: [...existingTags, { system: CONVERTED_SYS, code: arch.key }] };
        await o.fhir.update(fresh);
        // 5. Update the Appointment reason so the header/tracking board match the note.
        const apptId = fresh.appointment?.[0]?.reference?.split('/')?.[1];
        if (apptId) {
          try {
            const appt: any = await o.fhir.get({ resourceType: 'Appointment', id: apptId });
            appt.description = sc.visit.reasonForVisit;
            appt.reasonCode = [{ text: sc.visit.reasonForVisit }];
            await o.fhir.update(appt);
          } catch {
            /* non-fatal */
          }
        }
        done++;
        if (done % 50 === 0) console.log(`  …${idx}/${slice.length} (converted ${done})`);
      } catch (e: any) {
        console.log(`  ✗ ${encId}: ${e?.message ?? e}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()));
  console.log(`\nDone. Converted ${done} visits; skipped ${skipped} (already converted).`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
