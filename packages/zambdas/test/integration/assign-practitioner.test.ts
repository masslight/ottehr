import Oystehr from '@oystehr/sdk';
import { M2MClientMockType, PRACTITIONER_CODINGS } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for assign-practitioner: assign the caller practitioner to an
// encounter with an attender role.
describe('assign-practitioner integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let practitionerId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('assign-practitioner.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    practitionerId = setup.testUserM2MProfile.replace('Practitioner/', '');
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('assigns a practitioner to an encounter', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'assign-practitioner',
      encounterId: base.encounter.id,
      practitionerId,
      userRole: PRACTITIONER_CODINGS.Attender,
    });
    expect(response.output).toBeDefined();
  });
});
