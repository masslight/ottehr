// Audits the full clinical content of a few generated visits — every resource
// that would constitute a real progress note (dx, exam/ROS, vitals, meds, labs,
// imaging, procedures, immunizations, the rendered note PDF) — so we can see
// what a typical generated note contains and where the gaps are.
//
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx audit-note.ts [--reason "Cough"] [--n 3]

import { arg, argInt } from '../shared/cli';
import { createOystehrFromEnv } from '../shared/oystehr-client';

(async () => {
  const reason = arg('--reason', '');
  const N = argInt('--n', { default: 4, min: 1 });
  const o = await createOystehrFromEnv();

  // Grab some fulfilled appointments (optionally filtered by reason text).
  const params: any[] = [
    { name: 'status', value: 'fulfilled' },
    { name: 'date', value: 'ge2025-06-01' },
    { name: '_count', value: '40' },
  ];
  const appts = (await o.fhir.search({ resourceType: 'Appointment', params }))
    .unbundle()
    .filter((r: any) => r.resourceType === 'Appointment') as any[];
  const match = appts
    .filter(
      (a) => !reason || (a.description || a.reasonCode?.[0]?.text || '').toLowerCase().includes(reason.toLowerCase())
    )
    .slice(0, N);

  for (const a of match) {
    const encs = (
      await o.fhir.search({
        resourceType: 'Encounter',
        params: [{ name: 'appointment', value: `Appointment/${a.id}` }],
      })
    ).unbundle() as any[];
    const enc = encs[0];
    if (!enc) continue;
    const reasonText = a.description || enc.reasonCode?.[0]?.text || '(no reason)';
    console.log(`\n══════════════════════════════════════════════════════════════`);
    console.log(`Appt ${a.id}  ${a.start?.slice(0, 10)}  status=${a.status}`);
    console.log(`Reason: ${reasonText}`);
    console.log(`Encounter ${enc.id}`);

    const byType: Record<string, any[]> = {};
    // Types whose search errored — a failed query must report as unknown, not
    // masquerade as "0 resources" (a false-clean for an audit tool).
    const searchErrors: Record<string, string> = {};
    for (const [rt, param] of [
      ['Condition', 'encounter'],
      ['Observation', 'encounter'],
      ['MedicationRequest', 'encounter'],
      ['MedicationStatement', 'context'],
      ['MedicationAdministration', 'context'],
      ['ServiceRequest', 'encounter'],
      ['DiagnosticReport', 'encounter'],
      ['Procedure', 'encounter'],
      ['Immunization', 'encounter'],
      ['DocumentReference', 'encounter'],
    ] as const) {
      try {
        const rs = (
          await o.fhir.search({
            resourceType: rt as any,
            params: [
              { name: param, value: `Encounter/${enc.id}` },
              { name: '_count', value: '200' },
            ],
          })
        ).unbundle() as any[];
        byType[rt] = rs.filter((r: any) => r.resourceType === rt);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ! ${rt} search failed for Encounter/${enc.id}: ${msg}`);
        searchErrors[rt] = msg;
        byType[rt] = [];
      }
    }
    // Count formatter: 'ERR' (not 0) for types whose search failed.
    const n = (rt: string): string => (searchErrors[rt] ? 'ERR' : String(byType[rt].length));

    // Conditions split by category/meta-tag (dx vs CC/HPI/ROS/MDM).
    const condCat = (c: any): string =>
      c.category?.[0]?.coding?.[0]?.code ||
      c.meta?.tag?.map((t: any) => t.code).join(',') ||
      c.verificationStatus?.coding?.[0]?.code ||
      'cond';
    const condGroups: Record<string, number> = {};
    for (const c of byType.Condition) condGroups[condCat(c)] = (condGroups[condCat(c)] || 0) + 1;

    // Observations split: vitals vs exam vs ros vs other (by meta system).
    const obsKind = (ob: any): string => {
      const sys = (ob.meta?.tag || []).map((t: any) => t.system || '').join(' ');
      if (/exam-observation/.test(sys)) return 'exam';
      if (/ros-observation/.test(sys)) return 'ros';
      if (ob.category?.some((c: any) => c.coding?.some((cc: any) => cc.code === 'vital-signs'))) return 'vital';
      return 'obs-other';
    };
    const obsGroups: Record<string, number> = {};
    for (const ob of byType.Observation) obsGroups[obsKind(ob)] = (obsGroups[obsKind(ob)] || 0) + 1;

    console.log(`  Conditions(${n('Condition')}):`, JSON.stringify(condGroups));
    console.log(`  Observations(${n('Observation')}):`, JSON.stringify(obsGroups));
    console.log(
      `  MedicationRequest (eRx): ${n('MedicationRequest')}  | MedicationStatement (home): ${n(
        'MedicationStatement'
      )}  | MedicationAdministration: ${n('MedicationAdministration')}`
    );
    console.log(`  ServiceRequest (orders): ${n('ServiceRequest')}  | DiagnosticReport: ${n('DiagnosticReport')}`);
    console.log(
      `  Procedure: ${n('Procedure')}  | Immunization: ${n('Immunization')}  | DocumentReference: ${n(
        'DocumentReference'
      )}`
    );
    const erroredTypes = Object.keys(searchErrors);
    if (erroredTypes.length) {
      console.log(`  ⚠ Search errors (counts above are UNKNOWN, not zero): ${erroredTypes.join(', ')}`);
    }
    // Show diagnosis text + meds + orders briefly
    const dx = byType.Condition.filter((c: any) => /encounter-diagnosis|diagnosis/i.test(condCat(c)))
      .map((c: any) => c.code?.coding?.[0]?.code || c.code?.text)
      .filter(Boolean);
    if (dx.length) console.log(`  Dx codes: ${dx.join(', ')}`);
    const meds = byType.MedicationRequest.map(
      (m: any) => m.medicationCodeableConcept?.text || m.medicationCodeableConcept?.coding?.[0]?.display
    ).filter(Boolean);
    if (meds.length) console.log(`  eRx: ${meds.join('; ')}`);
    const orders = byType.ServiceRequest.map((s: any) => s.code?.text || s.code?.coding?.[0]?.display).filter(Boolean);
    if (orders.length) console.log(`  Orders: ${orders.join('; ')}`);
    const docs = byType.DocumentReference.map(
      (d: any) => d.type?.text || d.type?.coding?.[0]?.display || d.description || d.content?.[0]?.attachment?.title
    ).filter(Boolean);
    if (docs.length) console.log(`  Documents: ${docs.join('; ')}`);
  }
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
