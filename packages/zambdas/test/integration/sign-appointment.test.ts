import Oystehr from '@oystehr/sdk';
import { M2MClientMockType, PRACTITIONER_CODINGS } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for sign-appointment: sign (complete) a visit. The encounter needs
// an attending practitioner; the visit-note PDF + patient email are deferred to
// an async subscription Task (not triggered in the local server), so this stays
// FHIR-only.
describe('sign-appointment integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('sign-appointment.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const practitionerId = setup.testUserM2MProfile.replace('Practitioner/', '');
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    await oystehrAdmin.fhir.patch({
      resourceType: 'Encounter',
      id: base.encounter.id!,
      operations: [
        {
          op: 'add',
          path: '/participant',
          value: [
            {
              type: [{ coding: [PRACTITIONER_CODINGS.Attender[0]] }],
              individual: { reference: `Practitioner/${practitionerId}` },
            },
          ],
        },
      ],
    });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('signs an appointment', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'sign-appointment',
      appointmentId: base.appointment.id,
      encounterId: base.encounter.id,
      timezone: 'America/New_York',
      supervisorApprovalEnabled: false,
    });
    expect(response.output).toBeDefined();
  });
});
