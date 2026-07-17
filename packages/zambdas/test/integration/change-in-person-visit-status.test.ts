import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for change-in-person-visit-status: advances the visit status of the
// seed appointment/encounter (FHIR-only). The encounter needs an open statusHistory.
describe('change-in-person-visit-status integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('change-in-person-visit-status.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    await oystehrAdmin.fhir.patch<Encounter>({
      resourceType: 'Encounter',
      id: base.encounter.id!,
      operations: [
        {
          op: 'add',
          path: '/statusHistory',
          value: [{ status: 'planned', period: { start: new Date().toISOString() } }],
        },
      ],
    });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('changes the in-person visit status', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'change-in-person-visit-status',
      encounterId: base.encounter.id,
      updatedStatus: 'arrived',
    });
    expect(response.output).toBeDefined();
  });
});
