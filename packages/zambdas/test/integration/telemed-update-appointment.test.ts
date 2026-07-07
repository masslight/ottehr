import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for telemed-update-appointment: update the appointment's patient
// demographics. patient.id is omitted so the caller-access (403) check is
// skipped and the appointment's own patient is updated. FHIR-only.
describe('telemed-update-appointment integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('telemed-update-appointment.test.ts', M2MClientMockType.patient);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('updates the appointment patient demographics', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'telemed-update-appointment',
      appointmentId: base.appointment.id,
      patient: {
        firstName: 'Jon',
        lastName: 'Snow',
        dateOfBirth: '2002-07-07',
        sex: 'male',
        email: 'john.doe@example.com',
        emailUser: 'Patient',
      },
    });
    const output = response.output as { appointmentId: string };
    expect(output).toBeDefined();
    expect(output.appointmentId).toBe(base.appointment.id);
  });
});
