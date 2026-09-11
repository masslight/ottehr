/**
 * The FHIR cost of opening Review & Sign once the EHR reads the chart through the sections: the page makes
 * two chart reads — get-visit-note, and get-chart-section for the addendum list, whose note type is not part
 * of the visit note's set (see apps/ehr/src/features/visits/shared/hooks/reviewAndSignLoad.test.tsx for the
 * client side of that measurement). Both run here through the real builders against the golden FHIR server.
 */
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildChartSection } from '../../src/shared/chart-sections/registry';
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

  it('costs two chart reads, nine FHIR round trips and 35 searches for the whole page', async () => {
    const client = { oystehr: server.oystehr, m2mToken: 'token' };
    const perRead: Record<string, { fhirHttpRequests: number; fhirSearches: number }> = {};

    const measure = async (name: string, read: () => Promise<unknown>): Promise<void> => {
      const before = server.recorded.length;
      await read();
      const mine = server.recorded.slice(before);
      perRead[name] = {
        fhirHttpRequests: mine.length,
        fhirSearches: mine.reduce((n, call) => n + call.urls.length, 0),
      };
    };

    await measure('get-visit-note', () => buildVisitNote(client, GOLDEN_IDS.encounterId));
    await measure('get-chart-section notes (addendum)', () =>
      buildChartSection(client, GOLDEN_IDS.encounterId, 'notes', { types: [NOTE_TYPE.ADDENDUM] })
    );

    expect(perRead).toEqual({
      'get-visit-note': { fhirHttpRequests: 8, fhirSearches: 33 },
      'get-chart-section notes (addendum)': { fhirHttpRequests: 1, fhirSearches: 2 },
    });
    const urls = server.recorded.flatMap((call) => call.urls);
    expect({
      chartReads: Object.keys(perRead).length,
      fhirHttpRequests: server.recorded.length,
      fhirSearches: urls.length,
      // The Encounter read is the only search issued twice: each zambda call anchors itself on it.
      repeatedSearches: urls.length - new Set(urls).size,
    }).toEqual({ chartReads: 2, fhirHttpRequests: 9, fhirSearches: 35, repeatedSearches: 1 });
  });
});
