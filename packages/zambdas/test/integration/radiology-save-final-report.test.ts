import Oystehr from '@oystehr/sdk';
import { DiagnosticReport } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for radiology-save-final-report: create an order, save a
// preliminary report (creates the DiagnosticReport), then save the final report
// which flips that DiagnosticReport to 'final'. AdvaPACS is mocked by global
// setup. Created radiology resources are removed afterwards.
describe('radiology-save-final-report integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let serviceRequestId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('radiology-save-final-report.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const created = await oystehrZambdas.zambda.execute({
      id: 'radiology-create-order',
      encounterId: base.encounter.id,
      // icd-10-search zambda was removed; pass a valid ICD-10 code directly. radiology-create-order
      // still validates it via searchIcd10Codes, which returns exactly one match for E11.9.
      diagnosisCodes: ['E11.9'],
      cptCode: '71045',
      stat: false,
      clinicalHistory: 'Integration test clinical history',
      consentObtained: false,
    });
    serviceRequestId = (created.output as { serviceRequestId: string }).serviceRequestId;
    await oystehrZambdas.zambda.execute({
      id: 'radiology-save-preliminary-report',
      serviceRequestId,
      report: 'Integration test preliminary report',
    });
  }, 60_000);

  afterAll(async () => {
    for (const resourceType of ['ServiceRequest', 'Procedure', 'Task', 'DiagnosticReport'] as const) {
      try {
        const found = (
          await oystehrAdmin.fhir.search({
            resourceType,
            params: [{ name: 'encounter', value: `Encounter/${base.encounter.id}` }],
          })
        ).unbundle();
        await Promise.all(found.map((r) => oystehrAdmin.fhir.delete({ resourceType, id: r.id! })));
      } catch {
        /* best-effort */
      }
    }
    await cleanup();
  });

  it('saves a final radiology report', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'radiology-save-final-report',
      serviceRequestId,
      report: 'Integration test final report',
    });
    expect(response.output).toBeDefined();

    // The preliminary DiagnosticReport for this order is now finalized.
    const reports = (
      await oystehrAdmin.fhir.search<DiagnosticReport>({
        resourceType: 'DiagnosticReport',
        params: [{ name: 'based-on', value: `ServiceRequest/${serviceRequestId}` }],
      })
    ).unbundle();
    expect(reports.some((r) => r.status === 'final')).toBe(true);
  });
});
