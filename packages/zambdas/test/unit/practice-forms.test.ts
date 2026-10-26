import Oystehr, { FhirSearchParams } from '@oystehr/sdk';
import { FhirResource, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetAllPages } = vi.hoisted(() => ({ mockGetAllPages: vi.fn() }));
vi.mock('utils/lib/fhir/getAllFhirSearchPages', () => ({ getAllFhirSearchPages: mockGetAllPages }));

import {
  FORM_PLACEMENT_TAG_SYSTEM,
  PAPERWORK_FLOW_TAG,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  QR_DISTRIBUTION_TAG,
  TIMEZONE_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { getEncounterFormResponses, getPatientFormResponses } from '../../src/shared/practice-forms';

const form = (url: string, title: string, placement: string): Questionnaire => ({
  resourceType: 'Questionnaire',
  id: `${url}-id`,
  url,
  version: '1.0.0',
  title,
  status: 'active',
  meta: { tag: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG, { system: FORM_PLACEMENT_TAG_SYSTEM, code: placement }] },
  item: [{ linkId: 'page', type: 'group', item: [{ linkId: 'q1', type: 'string', text: 'Question' }] }],
});

const flow = (url: string, derivedFrom: string[]): Questionnaire => ({
  resourceType: 'Questionnaire',
  url,
  version: '1.0.0',
  status: 'active',
  derivedFrom,
});

const qr = (id: string, encounterId: string, canonical: string, sent = true): QuestionnaireResponse => ({
  resourceType: 'QuestionnaireResponse',
  id,
  status: 'completed',
  questionnaire: canonical,
  encounter: { reference: `Encounter/${encounterId}` },
  ...(sent && { meta: { tag: [QR_DISTRIBUTION_TAG] } }),
});

const tagged = (params: FhirSearchParams<FhirResource>['params'], value: string): boolean =>
  (params ?? []).some((p) => p.name === '_tag' && p.value === value);

let responseSearchParams: FhirSearchParams<FhirResource>['params'];

describe('getPatientFormResponses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responseSearchParams = undefined;
    mockGetAllPages.mockImplementation(async ({ resourceType, params }: FhirSearchParams<FhirResource>) => {
      if (
        resourceType === 'Questionnaire' &&
        tagged(params, `${PAPERWORK_FLOW_TAG.system}|${PAPERWORK_FLOW_TAG.code}`)
      ) {
        return [flow('vanderbilt-flow', ['vanderbilt|1.0.0']), flow('consent-flow', ['consent|1.0.0'])];
      }
      if (resourceType === 'Questionnaire') {
        return [form('sdoh', 'SDOH', 'questionnaires'), form('vanderbilt', 'Vanderbilt', 'questionnaires')];
      }
      responseSearchParams = params;
      return [
        { resourceType: 'Encounter', id: 'enc-old', appointment: [{ reference: 'Appointment/appt-old' }] },
        { resourceType: 'Encounter', id: 'enc-new', appointment: [{ reference: 'Appointment/appt-new' }] },
        {
          resourceType: 'Appointment',
          id: 'appt-old',
          start: '2025-10-02T14:00:00Z',
          status: 'fulfilled',
          participant: [{ actor: { reference: 'Location/office' }, status: 'accepted' }],
        },
        {
          resourceType: 'Appointment',
          id: 'appt-new',
          start: '2026-10-09T14:00:00Z',
          status: 'arrived',
          participant: [],
        },
        {
          resourceType: 'Location',
          id: 'office',
          extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: 'America/Los_Angeles' }],
        },
        qr('qr-sdoh-old', 'enc-old', 'sdoh|1.0.0'),
        qr('qr-sdoh-new', 'enc-new', 'sdoh|1.0.0'),
        qr('qr-flow', 'enc-new', 'vanderbilt-flow|1.0.0', false),
      ];
    });
  });

  it("returns every visit's responses, including forms answered in the visit's paperwork, with visit dates", async () => {
    const responses = await getPatientFormResponses({
      patientId: 'patient-1',
      placements: ['questionnaires'],
      oystehr: {} as Oystehr,
    });

    expect(
      responses.map((r) => [r.questionnaireTitle, r.questionnaireResponse.id, r.encounterId, r.deletable]).sort()
    ).toEqual([
      ['SDOH', 'qr-sdoh-new', 'enc-new', true],
      ['SDOH', 'qr-sdoh-old', 'enc-old', true],
      // Answered inside the visit's paperwork flow: shown, but deleted only with the paperwork.
      ['Vanderbilt', 'qr-flow', 'enc-new', false],
    ]);
    expect(responses.find((r) => r.questionnaireResponse.id === 'qr-sdoh-old')?.visitDate).toBe('2025-10-02T14:00:00Z');
  });

  it("dates each response in its visit office's timezone", async () => {
    const responses = await getPatientFormResponses({
      patientId: 'patient-1',
      placements: ['questionnaires'],
      oystehr: {} as Oystehr,
    });

    expect(responses.find((r) => r.questionnaireResponse.id === 'qr-sdoh-old')?.visitTimezone).toBe(
      'America/Los_Angeles'
    );
    expect(responses.find((r) => r.questionnaireResponse.id === 'qr-sdoh-new')?.visitTimezone).toBeUndefined();
  });

  it("asks only for responses to the placement's forms and the flows that contain them", async () => {
    await getPatientFormResponses({ patientId: 'patient-1', placements: ['questionnaires'], oystehr: {} as Oystehr });

    const questionnaireParam = responseSearchParams?.find((p) => p.name === 'questionnaire')?.value;
    expect(String(questionnaireParam).split(',').sort()).toEqual([
      'sdoh|1.0.0',
      'vanderbilt-flow|1.0.0',
      'vanderbilt|1.0.0',
    ]);
  });

  it('skips the response search when the practice has no forms with the placement', async () => {
    mockGetAllPages.mockImplementation(async () => []);

    const responses = await getPatientFormResponses({
      patientId: 'patient-1',
      placements: ['screening'],
      oystehr: {} as Oystehr,
    });

    expect(responses).toEqual([]);
    expect(mockGetAllPages).toHaveBeenCalledTimes(2);
  });
});

describe('getEncounterFormResponses', () => {
  const flowForm: Questionnaire = { ...form('vanderbilt', 'Vanderbilt', 'questionnaires'), id: 'vanderbilt-id' };
  const flowQuestionnaire: Questionnaire = { ...flow('vanderbilt-flow', ['vanderbilt|1.0.0']), id: 'flow-id' };
  const intakeQr = (encounterId: string): QuestionnaireResponse => ({
    ...qr('qr-intake', encounterId, 'vanderbilt-flow|1.0.0', false),
    item: [{ linkId: 'page', item: [{ linkId: 'q1', answer: [{ valueString: 'Yes' }] }] }],
  });

  const oystehr = {
    fhir: {
      search: vi.fn(async ({ resourceType, params }: FhirSearchParams<FhirResource>) => ({
        unbundle: () =>
          resourceType === 'QuestionnaireResponse'
            ? []
            : [flowForm, flowQuestionnaire].filter((q) => params?.some((p) => p.name === 'url' && p.value === q.url)),
      })),
    },
  } as unknown as Oystehr;

  beforeEach(() => vi.clearAllMocks());

  it("prints the forms the patient answered in this visit's paperwork", async () => {
    const forms = await getEncounterFormResponses(oystehr, 'enc-main', intakeQr('enc-main'), null);

    expect(forms.map((f) => f.questionnaireTitle)).toEqual(['Vanderbilt']);
  });

  // A follow-up note's resources carry its visit's paperwork, which belongs to the visit's own encounter:
  // the follow-up note shows none of it in the app, so its PDF must not print it either.
  it("leaves another encounter's paperwork out of a follow-up note", async () => {
    const forms = await getEncounterFormResponses(oystehr, 'enc-follow-up', intakeQr('enc-main'), null);

    expect(forms).toEqual([]);
    expect(oystehr.fhir.search).toHaveBeenCalledTimes(1);
  });
});
