/**
 * The FHIR cost of opening Review & Sign once the EHR reads the chart through the sections: one chart read,
 * get-visit-note. The addendum list on the page reads its own note type from the visit note's list (see
 * apps/ehr/src/features/visits/shared/hooks/reviewAndSignLoad.test.tsx for the client side of that
 * measurement). The read runs here through the real builders against the golden FHIR server.
 *
 * The six round trips are the concurrent batches of the visit note's wave (CHART_BATCH_TARGET_CONCURRENCY in
 * shared/chart-sections/fetch.ts); set it to 1 to trade the page's latency for a single round trip.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CHART_BATCH_TARGET_CONCURRENCY } from '../../src/shared/chart-sections/fetch';
import { buildVisitNote } from '../../src/shared/chart-sections/visit-note';
import { buildGoldenChartResources, GOLDEN_IDS, GOLDEN_NOW } from './fixtures/chart-data-golden.fixture';
import { createGoldenFhirServer, GoldenFhirServer } from './fixtures/golden-fhir-server';

describe('Review & Sign FHIR budget', () => {
  let server: GoldenFhirServer;

  beforeAll(() => {
    vi.useFakeTimers({ now: new Date(GOLDEN_NOW), toFake: ['Date'] });
    const fixture = buildGoldenChartResources();
    server = createGoldenFhirServer([...fixture.resources, fixture.patient, fixture.appointment]);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('costs one chart read, six FHIR round trips and 32 searches for the whole page', async () => {
    await buildVisitNote({ oystehr: server.oystehr, m2mToken: 'token' }, GOLDEN_IDS.encounterId);

    const urls = server.recorded.flatMap((call) => call.urls);
    expect({
      chartReads: 1,
      fhirHttpRequests: server.recorded.length,
      fhirSearches: urls.length,
      repeatedSearches: urls.length - new Set(urls).size,
      largestBatch: Math.max(...server.recorded.map((call) => call.urls.length)),
    }).toEqual({
      chartReads: 1,
      fhirHttpRequests: CHART_BATCH_TARGET_CONCURRENCY,
      fhirSearches: 32,
      repeatedSearches: 0,
      largestBatch: 6,
    });
  });
});
