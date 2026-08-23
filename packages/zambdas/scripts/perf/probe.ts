/**
 * Verifies the last dependency get-chart-data has on the patient id: the Appointment count behind
 * `patientHasPreviousVisits`, which today is `Appointment?patient._id=<patientId>&_summary=count`.
 * Checks the encounter-scoped equivalent returns the same `total`, including when the patient has
 * more than one appointment (the flag is `total > 1`, so an off-by-one here would be silent).
 *   ENV=local VITEST=true npx tsx scripts/perf/probe.ts
 */
import { BatchInputPostRequest } from '@oystehr/sdk';
import { FhirResource } from 'fhir/r4b';
import { PERF_FIXTURE_TAG_SYSTEM, teardownAllFixtures } from './fixtures';
import { startBenchServer } from './lib';

const meta = { tag: [{ system: PERF_FIXTURE_TAG_SYSTEM, code: 'perf-count-probe' }] };

const main = async (): Promise<void> => {
  const server = await startBenchServer();
  const oystehr = server.oystehrAdmin;

  const totalFor = async (url: string): Promise<{ status?: string; total?: number }> => {
    const result = await oystehr.fhir.batch<any>({ requests: [{ method: 'GET', url }] });
    const entry = result.entry?.[0];
    return { status: entry?.response?.status, total: (entry?.resource as any)?.total };
  };

  try {
    const patientRef = 'urn:uuid:patient';
    const requests: BatchInputPostRequest<FhirResource>[] = [
      {
        method: 'POST',
        url: '/Patient',
        fullUrl: patientRef,
        resource: {
          resourceType: 'Patient',
          active: true,
          name: [{ family: 'CountProbe', given: ['Pat'] }],
          birthDate: '1990-01-01',
          meta,
        } as any,
      },
      // Three appointments, so `total > 1` is exercised rather than the 0/1 boundary only.
      ...[0, 1, 2].map((i) => ({
        method: 'POST' as const,
        url: '/Appointment',
        fullUrl: `urn:uuid:appointment-${i}`,
        resource: {
          resourceType: 'Appointment',
          status: 'booked',
          start: `2026-0${i + 1}-10T14:00:00.000Z`,
          end: `2026-0${i + 1}-10T14:15:00.000Z`,
          participant: [{ actor: { reference: patientRef }, status: 'accepted' }],
          meta,
        } as any,
      })),
      {
        method: 'POST',
        url: '/Encounter',
        fullUrl: 'urn:uuid:encounter',
        resource: {
          resourceType: 'Encounter',
          status: 'in-progress',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
          subject: { reference: patientRef },
          appointment: [{ reference: 'urn:uuid:appointment-0' }],
          meta,
        } as any,
      },
    ];
    const created = (await oystehr.fhir.transaction<FhirResource>({ requests })).entry ?? [];
    const ids: Record<string, string> = {};
    created.forEach((e) => {
      if (e.resource?.resourceType && e.resource.id) ids[e.resource.resourceType] ??= e.resource.id;
    });
    const patientId = ids.Patient;
    const encounterId = ids.Encounter;
    console.log(`seeded Patient/${patientId} Encounter/${encounterId} with 3 appointments\n`);

    const direct = await totalFor(`/Appointment?patient._id=${patientId}&_summary=count`);
    const chained = await totalFor(
      `/Appointment?patient:Patient._has:Encounter:subject:_id=${encounterId}&_summary=count`
    );
    console.log(`direct  (patient._id):        status=${direct.status} total=${direct.total}`);
    console.log(`chained (via encounter):     status=${chained.status} total=${chained.total}`);
    const pass = chained.status === '200' && chained.total === direct.total && direct.total === 3;
    console.log(`\n${pass ? 'PASS' : 'FAIL'} — totals match and equal the 3 seeded appointments`);
  } finally {
    await teardownAllFixtures(oystehr, (line) => console.log(line));
    await server.close();
  }
};

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
