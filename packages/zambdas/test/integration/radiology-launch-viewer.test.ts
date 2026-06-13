import Oystehr from '@oystehr/sdk';
import { ServiceRequest } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for radiology-launch-viewer: returns a viewer URL for a completed
// radiology order. Launch-viewer requires the order's ServiceRequest to be
// 'completed', so the test creates an order and marks it completed. AdvaPACS
// (including the viewer-launch endpoint) is mocked by the global setup.
describe('radiology-launch-viewer integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let serviceRequestId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('radiology-launch-viewer.test.ts', M2MClientMockType.provider);
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
    // launch-viewer only allows viewing once the order is completed.
    await oystehrAdmin.fhir.patch<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
      operations: [{ op: 'replace', path: '/status', value: 'completed' }],
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
        // best-effort
      }
    }
    await cleanup();
  });

  it('returns a viewer url for a completed order', async () => {
    const response = await oystehrZambdas.zambda.execute({ id: 'radiology-launch-viewer', serviceRequestId });
    const output = response.output as { url: string };
    expect(output).toBeDefined();
    expect(typeof output.url).toBe('string');
  });
});
