/**
 * Characterization of the FHIR requests get-chart-data issues.
 *
 * The zambda builds its FHIR batches deterministically from `requestedFields`, so the URLs below are exact
 * for a page load. The scenarios replay every distinct react-query key mounted when the in-person
 * Review & Sign page opens and pin:
 *   - the URL set each call issues (snapshot),
 *   - the totals for the page load (explicit, so a change is a deliberate diff in this file),
 *   - the two ways a caller can steer a search off the requested encounter (documented as `it.fails`,
 *     so the day they are closed the tests flip to failing and get promoted to plain assertions).
 */
import Oystehr from '@oystehr/sdk';
import { Bundle, Encounter, FhirResource, Patient } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { progressNoteChartDataRequestedFields } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { IN_PERSON_NOTE_ID, NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ChartDataRequestedFields } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHART_DATA_MIN_BATCH_SIZE, getChartData } from '../../src/ehr/get-chart-data';

const ENCOUNTER_ID = '11111111-1111-4111-8111-111111111111';
const PATIENT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ENCOUNTER_ID = '99999999-9999-4999-8999-999999999999';

type RecordedCall = { kind: 'batch' | 'search'; urls: string[] };

const recorded: RecordedCall[] = [];

const encounter: Encounter = {
  resourceType: 'Encounter',
  id: ENCOUNTER_ID,
  status: 'in-progress',
  class: { code: 'AMB' },
  subject: { reference: `Patient/${PATIENT_ID}` },
};
const patient: Patient = { resourceType: 'Patient', id: PATIENT_ID };

const searchset = (resources: FhirResource[]): Bundle<FhirResource> => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: resources.length,
  entry: resources.map((resource) => ({ resource })),
});

const resourcesFor = (url: string): FhirResource[] => {
  if (url.startsWith('/Encounter?_id=')) return [encounter];
  if (url.startsWith('/Patient?')) return [patient];
  return [];
};

/** Records every FHIR request and answers each search with an empty page (Encounter and Patient excepted). */
const recordingOystehr = {
  fhir: {
    batch: async ({ requests }: { requests: { method: string; url: string }[] }) => {
      recorded.push({ kind: 'batch', urls: requests.map((r) => r.url) });
      return {
        resourceType: 'Bundle',
        type: 'batch-response',
        entry: requests.map((r) => ({
          response: { status: '200', outcome: { resourceType: 'OperationOutcome', id: 'ok' } },
          resource: searchset(resourcesFor(r.url)),
        })),
      } as unknown as Bundle<FhirResource>;
    },
    search: async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
      recorded.push({
        kind: 'search',
        urls: [`/${resourceType}?${params.map((p) => `${p.name}=${p.value}`).join('&')}`],
      });
      return { unbundle: () => [] };
    },
  },
} as unknown as Oystehr;

const noteTag = (types: NOTE_TYPE[]): string =>
  types.map((t) => `${PRIVATE_EXTENSION_BASE_URL}/${t}|${IN_PERSON_NOTE_ID}`).join(',');

interface Scenario {
  name: string;
  fields?: ChartDataRequestedFields;
}

/**
 * One entry per distinct react-query key mounted on /in-person/:id/review-and-sign, in mount order.
 * Every section summary on the page reads the shared progress-note query (useProgressNoteChartFields),
 * so the page costs the layout's unscoped call, the navigation context's hospitalizations, the note itself
 * and the addendum list.
 */
export const REVIEW_AND_SIGN_SCENARIOS: Scenario[] = [
  { name: '01 unscoped (InPersonLayout, Header, Sidebar, ProgressNote)', fields: undefined },
  { name: '02 InPersonNavigationContext', fields: { episodeOfCare: {} } },
  {
    name: '03 useProgressNoteChartFields (ProgressNoteDetails, MissingCard, ReviewAndSignButton, section summaries)',
    fields: progressNoteChartDataRequestedFields,
  },
  {
    name: '04 AddendumCard GenericNoteList',
    fields: {
      notes: { _search_by: 'encounter', _sort: '-_lastUpdated', _count: 1000, _tag: noteTag([NOTE_TYPE.ADDENDUM]) },
    },
  },
];

/** The eRX screen is the only reader of preferredPharmacies, and so the only request that needs the Patient. */
const PREFERRED_PHARMACIES_SCENARIO: Scenario = {
  name: 'ERxContainer',
  fields: { practitioners: {}, prescribedMedications: { _tag: 'erx-medication' }, preferredPharmacies: {} },
};

interface ScenarioResult {
  name: string;
  fhirHttpRequests: number;
  fhirSearches: number;
  urls: string[];
  /** The FHIR round trips this scenario made, in the order they were issued. */
  calls: RecordedCall[];
}

async function runScenario(scenario: Scenario): Promise<ScenarioResult> {
  const before = recorded.length;
  await getChartData(recordingOystehr, 'token', ENCOUNTER_ID, scenario.fields);
  const mine = recorded.slice(before);
  return {
    name: scenario.name,
    fhirHttpRequests: mine.length,
    fhirSearches: mine.reduce((n, call) => n + call.urls.length, 0),
    urls: mine.flatMap((call) => call.urls),
    calls: mine,
  };
}

async function runAll(scenarios: Scenario[]): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(scenario));
  }
  return results;
}

const summarize = (
  results: ScenarioResult[]
): { fhirHttpRequests: number; fhirSearches: number; distinctSearches: number; redundantSearches: number } => {
  const urls = results.flatMap((r) => r.urls);
  const distinct = new Set(urls).size;
  return {
    fhirHttpRequests: results.reduce((n, r) => n + r.fhirHttpRequests, 0),
    fhirSearches: urls.length,
    distinctSearches: distinct,
    redundantSearches: urls.length - distinct,
  };
};

describe('get-chart-data FHIR request budget', () => {
  beforeEach(() => {
    recorded.length = 0;
  });

  it('pins the FHIR searches issued for every distinct request on the Review & Sign page', async () => {
    const results = await runAll([...REVIEW_AND_SIGN_SCENARIOS, PREFERRED_PHARMACIES_SCENARIO]);
    // Snapshot the URL set of every scenario so that any change in what the endpoint searches is visible in
    // review rather than measured after the fact.
    expect(results.map(({ name, urls }) => ({ name, urls }))).toMatchSnapshot();
  });

  it('opening Review & Sign costs 4 calls, 33 FHIR searches (29 distinct) over 13 concurrent batches', async () => {
    // The redundancy is the Encounter read each call makes plus the hospitalizations the navigation context
    // and the note both ask for. Round trips are a latency choice rather than a cost: each call spreads its
    // searches over concurrent batches (see CHART_DATA_BATCH_TARGET_CONCURRENCY).
    const results = await runAll(REVIEW_AND_SIGN_SCENARIOS);
    expect(results).toHaveLength(4);
    expect(summarize(results)).toEqual({
      fhirHttpRequests: 13,
      fhirSearches: 33,
      distinctSearches: 29,
      redundantSearches: 4,
    });
  });

  it('fetches the Patient only when preferredPharmacies is requested, inside a chart batch', async () => {
    const reviewAndSign = await runAll(REVIEW_AND_SIGN_SCENARIOS);
    expect(reviewAndSign.flatMap((r) => r.urls).filter((url) => url.startsWith('/Patient?'))).toEqual([]);

    recorded.length = 0;
    const pharmacies = await runScenario(PREFERRED_PHARMACIES_SCENARIO);
    expect(pharmacies.urls.filter((url) => url.startsWith('/Patient?'))).toHaveLength(1);
    // No dedicated round trip for it: the Patient search shares a batch with other chart searches.
    const patientBatch = recorded.find((call) => call.urls.some((url) => url.startsWith('/Patient?')));
    expect(patientBatch?.kind).toBe('batch');
    expect(patientBatch?.urls.length).toBeGreaterThan(1);
  });

  it('the progress-note request carries the accident and the surgical-history note', async () => {
    const [progressNote] = await runAll(REVIEW_AND_SIGN_SCENARIOS.filter((s) => s.name.startsWith('03')));
    expect(progressNote.urls).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^\/Condition\?encounter=.*&_tag=accident$/),
        expect.stringMatching(/^\/Procedure\?encounter=.*&_tag=surgical-history-note$/),
      ])
    );
  });

  it('spreads a call over concurrent chart batches of at least three searches, the remainder aside', async () => {
    const [unscoped, navigation, progressNote] = await runAll(REVIEW_AND_SIGN_SCENARIOS);
    // The appointment count is a single-search batch on purpose (it stays out of the merged chart bundle);
    // the chart searches are chunked into batches of at least CHART_DATA_MIN_BATCH_SIZE, the last one taking
    // whatever is left.
    const chartBatchSizes = (result: ScenarioResult): number[] =>
      result.calls
        .filter((call) => call.kind === 'batch' && !call.urls.some((url) => url.includes('_summary=count')))
        .map((call) => call.urls.length);
    expect(navigation.fhirHttpRequests).toBe(1);
    [unscoped, progressNote].forEach((result) => {
      const sizes = chartBatchSizes(result);
      expect(sizes.length).toBeGreaterThan(1);
      sizes.slice(0, -1).forEach((size) => expect(size).toBeGreaterThanOrEqual(CHART_DATA_MIN_BATCH_SIZE));
      expect(sizes[sizes.length - 1]).toBeGreaterThanOrEqual(1);
    });
  });

  it('eight of the distinct searches carry only their anchor, six of which return mixed content', async () => {
    const results = await runAll(REVIEW_AND_SIGN_SCENARIOS);
    const distinct = [...new Set(results.flatMap((r) => r.urls))];
    const anchorOnly = distinct.filter((url) => {
      const query = url.split('?')[1] ?? '';
      const params = query.split('&').map((p) => p.split('=')[0]);
      // Anchors and sorting only: nothing that narrows which resources of the type come back.
      return params.every((p) =>
        [
          'encounter',
          'subject:Patient._has:Encounter:subject:_id',
          'patient:Patient._has:Encounter:subject:_id',
          '_sort',
        ].includes(p)
      );
    });
    // For these two the resource type is the intended filter: every allergy and hospitalization is wanted.
    const singlePurpose = ['/AllergyIntolerance', '/EpisodeOfCare'];
    // These six return every resource of the type and leave the mapper to discard by tag: all
    // communications, every condition and procedure the patient ever had, all observations on the
    // encounter, all document references, all medication requests. (Every ServiceRequest search carries a
    // status or tag filter, so none of them is anchor-only.)
    const mixedContent = [
      '/Communication',
      '/Condition',
      '/DocumentReference',
      '/MedicationRequest',
      '/Observation',
      '/Procedure',
    ];
    expect(anchorOnly.map((url) => url.split('?')[0]).sort()).toEqual([...singlePurpose, ...mixedContent].sort());
  });

  describe('the caller can steer searches off the requested encounter (closed by the chart-section rewrite)', () => {
    const anchoredTo = (url: string, id: string): boolean =>
      url.includes(`_id=${id}`) || url.includes(`Encounter/${id}`) || url.includes(`encounter=${id}`);

    it.fails('procedures.encounterIds cannot substitute other encounters for the requested one', async () => {
      const result = await runScenario({
        name: 'encounterIds escape hatch',
        fields: { procedures: { encounterIds: [OTHER_ENCOUNTER_ID] } },
      });
      result.urls.forEach((url) => expect(anchoredTo(url, ENCOUNTER_ID)).toBe(true));
    });

    it.fails('client-supplied include legs are not forwarded to FHIR', async () => {
      const result = await runScenario({
        name: 'revinclude escape hatch',
        fields: {
          observations: {
            _revinclude: 'Observation:performer',
            '_revinclude:iterate': { type: 'string', value: 'Observation:performer' },
          },
        },
      });
      result.urls.forEach((url) => expect(url).not.toContain('_revinclude'));
    });
  });
});
