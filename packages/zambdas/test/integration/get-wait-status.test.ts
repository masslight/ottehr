import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getTelemedRequiredAppointmentEncounterExtensions } from '../../src/patient/appointment/helpers';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-wait-status: an authenticated patient asks for the waiting-room
// status of their (telemed) appointment; returns a 200 status payload. The endpoint
// requires the encounter to carry a video-room virtual-service extension, so the seed
// encounter is patched to add it.
describe('get-wait-status integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-wait-status.test.ts', M2MClientMockType.patient);
    oystehrAdmin = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);

    const { encExtensions } = getTelemedRequiredAppointmentEncounterExtensions(
      `Patient/${base.patient.id}`,
      new Date().toISOString()
    );
    await oystehrAdmin.fhir.patch<Encounter>({
      resourceType: 'Encounter',
      id: base.encounter.id!,
      operations: [{ op: 'add', path: '/extension', value: encExtensions }],
    });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns the wait status for an appointment', async () => {
    const response = await oystehrPatient.zambda.executePublic({
      id: 'get-wait-status',
      appointmentID: base.appointment.id,
    });
    expect(response.output).toBeDefined();
    expect((response.output as { status?: string }).status).toBeDefined();
  });
});
