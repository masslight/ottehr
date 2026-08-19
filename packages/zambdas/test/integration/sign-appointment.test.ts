import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PRACTITIONER_CODINGS } from 'utils/lib/types/data/appointments/appointments.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NO_PROVIDER_ASSIGNED_MESSAGE } from '../../src/ehr/sign-appointment/helpers';
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
  let processId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('sign-appointment.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;
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

  // The assigned provider is the note's rendering provider, so a visit with an empty Provider slot
  // must not sign. Its own appointment graph, since `base`'s encounter is given an attender above.
  //
  // Asserted on the message, not just "it threw": a bare rejection would also be satisfied by a
  // timeout or an auth failure and would not prove this guard ran. The message reaches us because
  // the guard throws an APIError — a plain Error would surface as a 500 "Internal error".
  // Catch-and-read-`.message` rather than `.rejects.toThrow(regex)` because OystehrSdkError is not
  // guaranteed to be a proper Error subclass; see admin-update-group.test.ts.
  it('refuses to sign a visit with no provider assigned', async () => {
    const unassigned = await insertInPersonAppointmentBase(oystehrAdmin, processId);

    let caught: unknown;
    try {
      await oystehrZambdas.zambda.execute({
        id: 'sign-appointment',
        appointmentId: unassigned.appointment.id,
        encounterId: unassigned.encounter.id,
        timezone: 'America/New_York',
        supervisorApprovalEnabled: false,
      });
    } catch (e) {
      caught = e;
    }

    if (!caught) throw new Error('expected sign-appointment to refuse a visit with no provider assigned');
    expect((caught as { message?: string }).message).toBe(NO_PROVIDER_ASSIGNED_MESSAGE);
  }, 60_000);
});
