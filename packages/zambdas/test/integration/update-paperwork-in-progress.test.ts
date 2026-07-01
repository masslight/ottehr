import Oystehr from '@oystehr/sdk';
import { Flag } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for update-paperwork-in-progress: flag an appointment's paperwork
// as in-progress (a Flag/meta-tag). FHIR-backed.
describe('update-paperwork-in-progress integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('update-paperwork-in-progress.test.ts', M2MClientMockType.patient);
    oystehrAdmin = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    try {
      const flags = (
        await oystehrAdmin.fhir.search<Flag>({
          resourceType: 'Flag',
          params: [{ name: 'encounter', value: `Encounter/${base.encounter.id}` }],
        })
      ).unbundle();
      await Promise.all(flags.map((f) => oystehrAdmin.fhir.delete({ resourceType: 'Flag', id: f.id! })));
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('flags paperwork in progress for an appointment', async () => {
    const response = await oystehrPatient.zambda.executePublic({
      id: 'update-paperwork-in-progress',
      appointmentID: base.appointment.id,
      inProgress: new Date().toISOString(),
    });
    expect(response.output).toBeDefined();
  });
});
