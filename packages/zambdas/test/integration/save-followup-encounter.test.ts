import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for save-followup-encounter: in update mode (encounterId supplied),
// updates the seed encounter as a follow-up. Update mode avoids creating (and
// leaking) a new encounter. FHIR-only.
describe('save-followup-encounter integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('save-followup-encounter.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    // update mode does a `replace /type`; the seed encounter has no type, so add one.
    await oystehrAdmin.fhir.patch<Encounter>({
      resourceType: 'Encounter',
      id: base.encounter.id!,
      operations: [{ op: 'add', path: '/type', value: [{ text: 'Placeholder' }] }],
    });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('updates a follow-up encounter', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'save-followup-encounter',
      encounterDetails: {
        encounterId: base.encounter.id,
        patientId: base.patient.id,
        followupType: 'Follow-up Encounter',
      },
    });
    expect(response.output).toBeDefined();
  });
});
