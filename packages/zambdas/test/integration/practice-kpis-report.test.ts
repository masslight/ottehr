import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for practice-kpis-report: given a valid ISO dateRange, returns
// the report payload. Provider-scoped.
describe('practice-kpis-report integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('practice-kpis-report.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns a report for a valid date range', async () => {
    const end = DateTime.now().toUTC();
    const start = end.minus({ days: 7 });
    const response = await oystehrZambdas.zambda.execute({
      id: 'practice-kpis-report',
      dateRange: { start: start.toISO(), end: end.toISO() },
    });
    expect(response.output).toBeDefined();
    expect(typeof response.output).toBe('object');
  });
});
