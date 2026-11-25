import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for intake-get-appointments (prebook): with a date range and no
// explicit patientID, the M2M patient caller has no Person→RelatedPerson→Patient
// chain so getPatientsForUser returns empty — the zambda short-circuits with an
// empty appointments list, which is a valid happy-path 200 response.
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
    const response = await oystehrZambdas.zambda.execute({
      id: 'intake-get-appointments',
      dateRange: { greaterThan: now.minus({ days: 30 }).toISO(), lessThan: now.plus({ days: 30 }).toISO() },
    });
    expect(response.output).toBeDefined();
  });
});
