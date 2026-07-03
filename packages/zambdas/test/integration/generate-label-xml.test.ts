import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for generate-label-xml: builds the visit label XML for an encounter
// from the project's printing config + the encounter/patient. FHIR-only.
describe('generate-label-xml integration — happy path', () => {
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('generate-label-xml.test.ts', M2MClientMockType.provider);
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('generates the visit label XML for an encounter', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'generate-label-xml',
      type: 'visit',
      encounterId: base.encounter.id,
    });
    expect(response.output).toBeDefined();
  });
});
