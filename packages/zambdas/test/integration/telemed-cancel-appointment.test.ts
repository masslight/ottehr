import Oystehr from '@oystehr/sdk';
import { Appointment } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for telemed-cancel-appointment: cancel an appointment with a valid
// cancellation reason. The cancellation text is only sent when the patient has a
// user-relatedperson (the seed patient has none), so this stays FHIR-only.
describe('telemed-cancel-appointment integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('telemed-cancel-appointment.test.ts', M2MClientMockType.patient);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('cancels an appointment', async () => {
    await oystehrZambdas.zambda.execute({
      id: 'telemed-cancel-appointment',
      appointmentID: base.appointment.id,
      cancellationReason: 'Prefer in-person visit',
    });
    const updated = await oystehrAdmin.fhir.get<Appointment>({
      resourceType: 'Appointment',
      id: base.appointment.id!,
    });
    expect(updated.status).toBe('cancelled');
  });
});
