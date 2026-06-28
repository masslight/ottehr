// Deletes incomplete (non-fulfilled) Appointments belonging to SYNTHETIC patients,
// plus their linked Encounter / QuestionnaireResponse / harvest Tasks. The synthetic
// population is meant to be uniformly signed-complete (Appointment.status =
// fulfilled); any booked/arrived/checked-in/proposed/pending/waitlist appointment on
// a synth patient is leftover test/debug data. Patients/Coverage/etc. are left in
// place (shared, reused).
//
// SAFETY: scoped to patients carrying the synthetic-patient identifier, so it cannot
// touch real appointments even if pointed at a shared project. Dry-run by default —
// pass --execute to actually delete.
//
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx clean-incomplete-appointments.ts [--execute]

import { SYNTHETIC_PATIENT_ID_SYSTEM } from '../shared/constants';
import { createOystehrFromEnv } from '../shared/oystehr-client';

const EXECUTE = process.argv.includes('--execute');

const INCOMPLETE_STATUSES = 'proposed,pending,booked,arrived,checked-in,waitlist,noshow,cancelled,entered-in-error';

(async () => {
  const o = await createOystehrFromEnv();

  // 1. Collect all non-fulfilled appointments (paginated).
  const appts: any[] = [];
  let offset = 0;
  for (;;) {
    const b = await o.fhir.search({
      resourceType: 'Appointment',
      params: [
        { name: 'status', value: INCOMPLETE_STATUSES },
        { name: '_count', value: '500' },
        { name: '_offset', value: String(offset) },
      ],
    });
    const page = b.unbundle().filter((r: any) => r.resourceType === 'Appointment' && r.status !== 'fulfilled') as any[];
    if (!page.length) break;
    appts.push(...page);
    offset += page.length;
    if (page.length < 500) break;
  }

  // 2. Resolve each appointment's patient, then keep only those whose patient
  //    carries the synthetic identifier (the safety boundary).
  const patientIdOf = (a: any): string | undefined => {
    for (const p of a.participant ?? []) {
      const ref: string | undefined = p.actor?.reference;
      if (ref?.startsWith('Patient/')) return ref.split('/')[1];
    }
    return undefined;
  };

  const candidatePatientIds = [...new Set(appts.map(patientIdOf).filter((id): id is string => !!id))];
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

  const targets = appts.filter((a) => {
    const pid = patientIdOf(a);
    return pid && synthPatientIds.has(pid);
  });
  const skipped = appts.length - targets.length;

  console.log(
    `Non-fulfilled appointments: ${appts.length} | on synthetic patients: ${
      targets.length
    } | skipped (non-synthetic / no patient): ${skipped}${EXECUTE ? '' : '  [DRY RUN — pass --execute to delete]'}`
  );
  if (!EXECUTE) {
    for (const a of targets.slice(0, 15)) console.log(`  would delete Appointment/${a.id} (status ${a.status})`);
    if (targets.length > 15) console.log(`  …and ${targets.length - 15} more`);
    return;
  }

  let deleted = 0;
  let failed = 0;
  const del = async (rt: string, id: string): Promise<void> => {
    try {
      await o.fhir.delete({ resourceType: rt as 'Appointment', id });
      deleted++;
    } catch (e: any) {
      failed++;
      console.log(`  ✗ ${rt}/${id}: ${e?.message ?? e}`);
    }
  };

  let n = 0;
  for (const a of targets) {
    const encs = (
      await o.fhir.search({
        resourceType: 'Encounter',
        params: [{ name: 'appointment', value: `Appointment/${a.id}` }],
      })
    ).unbundle() as any[];
    for (const e of encs) {
      const qrs = (
        await o.fhir.search({
          resourceType: 'QuestionnaireResponse',
          params: [{ name: 'encounter', value: `Encounter/${e.id}` }],
        })
      ).unbundle() as any[];
      for (const qr of qrs) {
        const tasks = (
          await o.fhir.search({
            resourceType: 'Task',
            params: [{ name: 'focus', value: `QuestionnaireResponse/${qr.id}` }],
          })
        ).unbundle() as any[];
        for (const tk of tasks) if (tk.id) await del('Task', tk.id);
        if (qr.id) await del('QuestionnaireResponse', qr.id);
      }
      if (e.id) await del('Encounter', e.id);
    }
    if (a.id) await del('Appointment', a.id);
    n++;
    if (n % 10 === 0) console.log(`  …${n}/${targets.length} appointments processed`);
  }
  console.log(
    `\nDone. Deleted ${deleted} resources across ${targets.length} appointments; ${failed} delete(s) failed.`
  );
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
