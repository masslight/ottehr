import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for intake-get-appointments (prebook): given the caller patient id
// and a date range, returns the patient's prebook appointments (empty list is a
// valid happy-path result for the M2M patient).
describe('intake-get-appointments integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let patientId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('intake-get-appointments.test.ts', M2MClientMockType.patient);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    patientId = setup.testUserM2MProfile.replace('Patient/', '');
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns prebook appointments for a patient and date range', async () => {
    const now = DateTime.now().toUTC();
    const response = await oystehrZambdas.zambda.execute({
      id: 'intake-get-appointments',
      patientID: patientId,
      dateRange: { greaterThan: now.minus({ days: 30 }).toISO(), lessThan: now.plus({ days: 30 }).toISO() },
    });
    expect(response.output).toBeDefined();
  });
});
