import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for incomplete-encounters-report: returns the report of encounters in
// a date range (FHIR search; the result set may be empty but the response is 200).
describe('incomplete-encounters-report integration — happy path', () => {
  let oystehrProvider: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('incomplete-encounters-report.test.ts', M2MClientMockType.provider);
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns the incomplete encounters report for a date range', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'incomplete-encounters-report',
      dateRange: {
        start: DateTime.now().minus({ days: 7 }).toISO(),
        end: DateTime.now().toISO(),
      },
      encounterStatus: 'incomplete',
    });
    expect(response.output).toBeDefined();
  });
});
