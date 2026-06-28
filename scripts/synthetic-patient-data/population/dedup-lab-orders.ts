// Removes duplicate in-house lab orders on an encounter — keeps ONE order per
// (encounter, test name) and deletes the extras plus their dependent
// DiagnosticReport / Observation / Specimen / Task resources. Fixes the flu
// double-order left by an idempotency-miss in an earlier backfill run.
//
// SAFETY: scoped to SYNTHETIC patients (subject carries the synthetic identifier),
// so it cannot touch real lab orders even if pointed at a shared project. Dry-run
// by default — pass --execute to actually delete.
//
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx dedup-lab-orders.ts [--execute]

import { SYNTHETIC_PATIENT_ID_SYSTEM } from '../shared/constants';
import { createOystehrFromEnv } from '../shared/oystehr-client';

const EXECUTE = process.argv.includes('--execute');

const isLabSR = (s: any): boolean =>
  !!(s.code?.text || s.code?.coding?.[0]?.display) &&
  !(s.meta?.tag || []).some((t: any) =>
    ['disposition-follow-up', 'sub-follow-up', 'procedure', 'radiology'].includes(t.code)
  );
const srName = (s: any): string => (s.code?.text || s.code?.coding?.[0]?.display || '').toLowerCase();
const patientIdOf = (s: any): string | undefined => {
  const ref: string | undefined = s.subject?.reference;
  return ref?.startsWith('Patient/') ? ref.split('/')[1] : undefined;
};

(async () => {
  const o = await createOystehrFromEnv();

  // 1. Collect all lab ServiceRequests (paginated).
  const labSrs: any[] = [];
  let offset = 0;
  for (;;) {
    const b = await o.fhir.search({
      resourceType: 'ServiceRequest',
      params: [
        { name: '_count', value: '1000' },
        { name: '_offset', value: String(offset) },
      ],
    });
    const srs = b.unbundle().filter((r: any) => r.resourceType === 'ServiceRequest') as any[];
    if (!srs.length) break;
    for (const s of srs) if (isLabSR(s) && s.encounter?.reference) labSrs.push(s);
    offset += srs.length;
    if (srs.length < 1000) break;
  }

  // 2. Keep only ServiceRequests belonging to synthetic patients (the safety boundary).
  const candidatePatientIds = [...new Set(labSrs.map(patientIdOf).filter((id): id is string => !!id))];
  const synthPatientIds = new Set<string>();
  for (let i = 0; i < candidatePatientIds.length; i += 50) {
    const chunk = candidatePatientIds.slice(i, i + 50);
    const found = (
      await o.fhir.search({
        resourceType: 'Patient',
        params: [
          { name: '_id', value: chunk.join(',') },
          { name: 'identifier', value: `${SYNTHETIC_PATIENT_ID_SYSTEM}|` },
          { name: '_count', value: String(chunk.length) },
        ],
      })
    ).unbundle() as any[];
    for (const p of found) if (p.id) synthPatientIds.add(p.id);
  }

  // 3. Group synthetic-patient lab SRs by encounter+test name.
  const byKey = new Map<string, any[]>();
  for (const s of labSrs) {
    const pid = patientIdOf(s);
    if (!pid || !synthPatientIds.has(pid)) continue;
    const enc = s.encounter.reference.split('/')[1];
    if (!enc) continue;
    const key = `${enc}|${srName(s)}`;
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(s);
  }

  const dups = [...byKey.entries()].filter(([, arr]) => arr.length > 1);
  const totalExtra = dups.reduce((s, [, arr]) => s + (arr.length - 1), 0);
  console.log(
    `(encounter,test) groups with duplicates: ${dups.length} | extra orders to remove: ${totalExtra}${
      EXECUTE ? '' : '  [DRY RUN — pass --execute to delete]'
    }`
  );
  if (!EXECUTE) {
    for (const [key, arr] of dups.slice(0, 15)) console.log(`  ${key} ×${arr.length}`);
    return;
  }

  let removed = 0;
  let failed = 0;
  const del = async (rt: string, id: string): Promise<void> => {
    try {
      await o.fhir.delete({ resourceType: rt as 'ServiceRequest', id });
    } catch (e: any) {
      failed++;
      console.log(`  ✗ ${rt}/${id}: ${e?.message ?? e}`);
    }
  };

  const delDeps = async (srId: string): Promise<void> => {
    // DiagnosticReport, Observation, Task by based-on; Specimen by SR.specimen ref.
    for (const rt of ['DiagnosticReport', 'Observation', 'Task'] as const) {
      const rs = (
        await o.fhir.search({
          resourceType: rt,
          params: [
            { name: 'based-on', value: `ServiceRequest/${srId}` },
            { name: '_count', value: '100' },
          ],
        })
      ).unbundle() as any[];
      for (const r of rs) if (r.id) await del(rt, r.id);
    }
  };

  let n = 0;
  for (const [, arr] of dups) {
    // Keep the earliest-created; delete the rest.
    const sorted = arr.sort((a, b) => (a.meta?.lastUpdated || '').localeCompare(b.meta?.lastUpdated || ''));
    for (const s of sorted.slice(1)) {
      await delDeps(s.id);
      for (const spRef of s.specimen || []) {
        const id = spRef.reference?.split('/')[1];
        if (id) await del('Specimen', id);
      }
      await del('ServiceRequest', s.id);
      removed++;
    }
    n++;
    if (n % 25 === 0) console.log(`  …${n}/${dups.length} groups (removed ${removed})`);
  }
  console.log(`\nDone. Removed ${removed} duplicate lab orders (+ dependents); ${failed} delete(s) failed.`);
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
