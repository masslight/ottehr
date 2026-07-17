import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for cancel-appointment: cancels a booked appointment. Run with
// silent:true so the FHIR cancellation is exercised without any email/SMS (3p).
describe('cancel-appointment integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('cancel-appointment.test.ts', M2MClientMockType.patient);
    oystehrAdmin = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    // cancel-appointment reads the encounter's statusHistory; the base seed
    // encounter has none, so add an open one.
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

  it('cancels a booked appointment', async () => {
    const response = await oystehrPatient.zambda.executePublic({
      id: 'cancel-appointment',
      appointmentID: base.appointment.id,
      cancellationReason: 'Patient improved',
      language: 'en',
      silent: true,
    });
    expect(response.output).toBeDefined();

    const cancelled = await oystehrAdmin.fhir.get<Appointment>({
      resourceType: 'Appointment',
      id: base.appointment.id!,
    });
    expect(cancelled.status).toBe('cancelled');
  });
});
