import Oystehr from '@oystehr/sdk';
import { M2MClientMockType, PRACTITIONER_CODINGS } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for unassign-practitioner: remove a practitioner previously
// assigned to an encounter. The practitioner is assigned in setup.
describe('unassign-practitioner integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let practitionerId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('unassign-practitioner.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    practitionerId = setup.testUserM2MProfile.replace('Practitioner/', '');
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    await oystehrZambdas.zambda.execute({
      id: 'assign-practitioner',
      encounterId: base.encounter.id,
      practitionerId,
      userRole: PRACTITIONER_CODINGS.Attender,
    });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('unassigns a practitioner from an encounter', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'unassign-practitioner',
      encounterId: base.encounter.id,
      practitionerId,
      userRole: PRACTITIONER_CODINGS.Attender,
    });
    expect(response.output).toBeDefined();
  });
});
