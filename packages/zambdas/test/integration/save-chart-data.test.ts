import Oystehr from '@oystehr/sdk';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for save-chart-data (and delete-chart-data as cleanup): saves a chief
// complaint onto the seed encounter, then deletes it. Pairing the two keeps the
// created Condition from leaking. FHIR-only.
describe('save-chart-data integration — happy path', () => {
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('save-chart-data.test.ts', M2MClientMockType.provider);
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('saves a chief complaint then deletes it', async () => {
    const saveResponse = await oystehrProvider.zambda.execute({
      id: 'save-chart-data',
      encounterId: base.encounter.id,
      chiefComplaint: { text: 'Integration test cough' },
    });
    const saved = saveResponse.output as { chartData?: { chiefComplaint?: { resourceId?: string } } };
    expect(saved.chartData).toBeDefined();
    const resourceId = saved.chartData?.chiefComplaint?.resourceId;
    expect(resourceId).toBeDefined();

    const deleteResponse = await oystehrProvider.zambda.execute({
      id: 'delete-chart-data',
      encounterId: base.encounter.id,
      chiefComplaint: { resourceId },
    });
    expect(deleteResponse.output).toBeDefined();
  });
});
