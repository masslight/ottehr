import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for radiology-send-for-final-read: create a radiology order, then exercise the endpoint.
// AdvaPACS calls are mocked by the global setup. Created radiology resources are
// removed afterwards.
describe('radiology-send-for-final-read integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let serviceRequestId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('radiology-send-for-final-read.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const icd = (await oystehrZambdas.zambda.execute({ id: 'icd-10-search', search: 'diabetes' })).output as {
      codes: Array<{ code: string }>;
    };
    const created = await oystehrZambdas.zambda.execute({
      id: 'radiology-create-order',
      encounterId: base.encounter.id,
      diagnosisCode: icd.codes[0].code,
      cptCode: '71045',
      stat: false,
      clinicalHistory: 'Integration test clinical history',
      consentObtained: false,
    });
    serviceRequestId = (created.output as { serviceRequestId: string }).serviceRequestId;
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
        // best-effort
      }
    }
    await cleanup();
  });

  it('sends a radiology order for final read', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'radiology-send-for-final-read', serviceRequestId });
    expect(response.output).toBeDefined();
  });
});
