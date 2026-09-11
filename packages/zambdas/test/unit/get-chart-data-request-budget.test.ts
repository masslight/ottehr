/**
 * Characterization of the FHIR requests get-chart-data issues.
 *
 * The zambda builds its FHIR batch deterministically from `requestedFields`, so the URLs below are exact
 * for a page load. The scenarios replay every distinct react-query key mounted when the in-person
 * Review & Sign page opens, plus the two conditional ones, and pin:
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
import { getChartData } from '../../src/ehr/get-chart-data';

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

/** One entry per distinct react-query key mounted on /in-person/:id/review-and-sign, in mount order. */
export const REVIEW_AND_SIGN_SCENARIOS: Scenario[] = [
  { name: '01 unscoped (InPersonLayout, Header, Sidebar, ProgressNote)', fields: undefined },
  { name: '02 InPersonNavigationContext', fields: { episodeOfCare: {} } },
  {
    name: '03 MissingCard',
    fields: {
      medicalDecision: { _tag: 'medical-decision' },
      chiefComplaint: { _tag: 'chief-complaint' },
      historyOfPresentIllness: { _tag: 'history-of-present-illness' },
      patientInfoConfirmed: {},
      accident: { _tag: 'accident' },
    },
  },
  {
    name: '04 ReviewAndSignButton',
    fields: {
      medicalDecision: { _tag: 'medical-decision' },
      chiefComplaint: { _tag: 'chief-complaint' },
      historyOfPresentIllness: { _tag: 'history-of-present-illness' },
      accident: { _tag: 'accident' },
      inHouseLabResults: {},
      patientInfoConfirmed: {},
    },
  },
  {
    name: '05 ProgressNoteDetails (progressNoteChartDataRequestedFields)',
    fields: progressNoteChartDataRequestedFields,
  },
  { name: '06 usePatientInstructionsVisibility + PatientInstructionsContainer', fields: { disposition: {} } },
  {
    name: '07 ChiefComplaintContainer',
    fields: { historyOfPresentIllness: { _tag: 'history-of-present-illness' }, reasonForVisit: {} },
  },
  {
    name: '08 HpiMoiContainer',
    fields: {
      chiefComplaint: { _tag: 'chief-complaint' },
      mechanismOfInjury: { _tag: 'mechanism-of-injury' },
      accident: { _tag: 'accident' },
    },
  },
  { name: '09 SurgicalHistoryContainer', fields: { surgicalHistoryNote: { _tag: 'surgical-history-note' } } },
  { name: '10 AssessmentGroupContainer', fields: { medicalDecision: { _tag: 'medical-decision' } } },
  { name: '11 AddendumCard (legacy addendumNote)', fields: { addendumNote: {} } },
  {
    name: '12 AddendumCard GenericNoteList',
    fields: {
      notes: { _search_by: 'encounter', _sort: '-_lastUpdated', _count: 1000, _tag: noteTag([NOTE_TYPE.ADDENDUM]) },
    },
  },
  { name: '13 HospitalizationContainer (episodeOfCare refetch, staleTime 0)', fields: { episodeOfCare: {} } },
];

export const CONDITIONAL_SCENARIOS: Scenario[] = [
  { name: 'c1 PrescribedMedicationsContainer', fields: { prescribedMedications: {} } },
  { name: 'c2 ReviewOfSystemsContainer (legacy ros text)', fields: { ros: { _tag: 'ros' } } },
];

interface ScenarioResult {
  name: string;
  fhirHttpRequests: number;
  fhirSearches: number;
  urls: string[];
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
  };
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
    const results: ScenarioResult[] = [];
    for (const scenario of [...REVIEW_AND_SIGN_SCENARIOS, ...CONDITIONAL_SCENARIOS]) {
      results.push(await runScenario(scenario));
    }
    // Snapshot the URL set of every scenario so that any change in what the endpoint searches is visible in
    // review rather than measured after the fact.
    expect(results.map(({ name, urls }) => ({ name, urls }))).toMatchSnapshot();
  });

  it('opening Review & Sign costs 13 calls, 27 FHIR round trips and 71 searches, 40 of them redundant', async () => {
    const results: ScenarioResult[] = [];
    for (const scenario of REVIEW_AND_SIGN_SCENARIOS) {
      results.push(await runScenario(scenario));
    }
    expect(results).toHaveLength(13);
    expect(summarize(results)).toEqual({
      fhirHttpRequests: 27,
      fhirSearches: 71,
      distinctSearches: 31,
      redundantSearches: 40,
    });
  });

  it('every call re-fetches the Patient in its own round trip and the Encounter inside the chart batch', async () => {
    const results: ScenarioResult[] = [];
    for (const scenario of REVIEW_AND_SIGN_SCENARIOS) {
      results.push(await runScenario(scenario));
    }
    const patientSearches = results.flatMap((r) => r.urls).filter((url) => url.startsWith('/Patient?'));
    const encounterSearches = results.flatMap((r) => r.urls).filter((url) => url.startsWith('/Encounter?_id='));
    expect(patientSearches).toHaveLength(13);
    expect(encounterSearches).toHaveLength(13);
    // Only the unscoped call adds a third round trip, for the appointment count behind patientHasPreviousVisits.
    expect(results.map((r) => r.fhirHttpRequests)).toEqual([3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
  });

  it('nine of the distinct searches carry only their anchor, seven of which return mixed content', async () => {
    const results: ScenarioResult[] = [];
    for (const scenario of REVIEW_AND_SIGN_SCENARIOS) {
      results.push(await runScenario(scenario));
    }
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
    // These seven return every resource of the type and leave the mapper to discard by tag: all
    // communications, every condition and procedure the patient ever had, all observations on the
    // encounter, all document references, all medication requests, all service requests.
    const mixedContent = [
      '/Communication',
      '/Condition',
      '/DocumentReference',
      '/MedicationRequest',
      '/Observation',
      '/Procedure',
      '/ServiceRequest',
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
