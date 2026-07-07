import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for check-in: a public endpoint that checks a patient in for a
// booked appointment and reports paperwork/queue status. FHIR-backed.
describe('check-in integration — happy path', () => {
  let oystehrPatient: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('check-in.test.ts', M2MClientMockType.patient);
    oystehrPatient = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    // check-in reads the encounter's statusHistory; the seed encounter has none.
    await setup.oystehr.fhir.patch({
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

  it('checks a patient in for an appointment', async () => {
    const response = await oystehrPatient.zambda.executePublic({
      id: 'check-in',
      appointmentId: base.appointment.id,
    });
    expect(response.output).toBeDefined();
  });
});
