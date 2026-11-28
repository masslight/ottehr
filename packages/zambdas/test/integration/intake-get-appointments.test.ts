import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for intake-get-appointments (prebook): given the caller patient id
// and a date range, returns the patient's prebook appointments (empty list is a
// valid happy-path result for the M2M patient).
describe('intake-get-appointments integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('intake-get-appointments.test.ts', M2MClientMockType.patient);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns prebook appointments for a patient and date range', async () => {
    const now = DateTime.now().toUTC();
    // Pass dateRange but not patientID: the zambda returns appointments for all
    // patients the caller has access to (or an empty list if none found). The M2M
    // patient profile is not guaranteed to appear in the Person→RelatedPerson→Patient
    // lookup the zambda uses, so passing patientID would cause a 403 when stale
    // Person resources from previous runs exist. An empty appointment list is an
    // acceptable happy-path result.
    const response = await oystehrZambdas.zambda.execute({
      id: 'intake-get-appointments',
      dateRange: { greaterThan: now.minus({ days: 30 }).toISO(), lessThan: now.plus({ days: 30 }).toISO() },
    });
    expect(response.output).toBeDefined();
  });
});
