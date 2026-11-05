import { Appointment, Encounter, Location, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { buildFollowupEncounterType } from 'utils/lib/fhir/encounter';
import { resolveEffectiveQuestionnaire } from 'utils/lib/fhir/questionnaires';
import { getQuestionnaireAndValueSets } from 'utils/lib/helpers/paperwork/paperwork';
import { ServiceMode } from 'utils/lib/types/common';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { index } from '../../src/patient/paperwork/get-paperwork';
import { getUser, userHasAccessToPatient } from '../../src/shared/auth';
import { createClinicalOystehrClient } from '../../src/shared/helpers';
import { ZambdaInput } from '../../src/shared/types/common';

vi.mock('@sentry/node-core/light', async (importOriginal) => {
  const original = await importOriginal<typeof import('@sentry/node-core/light')>();
  return { ...original, captureException: vi.fn() };
});

vi.mock('../../src/shared/getAuth0Token', () => ({ getAuth0Token: vi.fn().mockResolvedValue('m2m-token') }));

vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/shared/helpers')>();
  return { ...original, createClinicalOystehrClient: vi.fn() };
});

vi.mock('../../src/shared/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/shared/auth')>();
  return { ...original, getUser: vi.fn(), userHasAccessToPatient: vi.fn() };
});

vi.mock('utils/lib/helpers/paperwork/paperwork', async (importOriginal) => {
  const original = await importOriginal<typeof import('utils/lib/helpers/paperwork/paperwork')>();
  return { ...original, getQuestionnaireAndValueSets: vi.fn() };
});

vi.mock('utils/lib/fhir/questionnaires', async (importOriginal) => {
  const original = await importOriginal<typeof import('utils/lib/fhir/questionnaires')>();
  return { ...original, resolveEffectiveQuestionnaire: vi.fn() };
});

const mockCreateClient = vi.mocked(createClinicalOystehrClient);

const APPOINTMENT_ID = '4fea2d5a-c653-4532-83b4-82ca7a2ebceb';

const APPOINTMENT: Appointment = {
  resourceType: 'Appointment',
  id: APPOINTMENT_ID,
  status: 'booked',
  start: '2026-11-05T01:30:00.000Z',
  appointmentType: { text: 'prebook' },
  participant: [{ actor: { reference: 'Location/loc-1' }, status: 'accepted' }],
};

const IN_PERSON_ENCOUNTER: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-main',
  status: 'planned',
  class: { system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html', code: 'ACUTE' },
  appointment: [{ reference: `Appointment/${APPOINTMENT_ID}` }],
};

const ANNOTATION_FOLLOWUP_ENCOUNTER: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-followup',
  status: 'finished',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR' },
  type: buildFollowupEncounterType('annotation'),
  partOf: { reference: 'Encounter/enc-main' },
  appointment: [{ reference: `Appointment/${APPOINTMENT_ID}` }],
};

const PATIENT: Patient = { resourceType: 'Patient', id: 'pat-1', name: [{ given: ['Pat'] }], birthDate: '1990-05-01' };
const LOCATION: Location = { resourceType: 'Location', id: 'loc-1', name: 'Test Office' };
const QUESTIONNAIRE_RESPONSE: QuestionnaireResponse = {
  resourceType: 'QuestionnaireResponse',
  id: 'qr-1',
  status: 'completed',
  questionnaire: 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson|1.0.0',
  encounter: { reference: 'Encounter/enc-main' },
};

const invoke = async (
  graph: unknown[],
  headers: Record<string, string> = {}
): Promise<{ statusCode: number; body: string }> => {
  mockCreateClient.mockReturnValue({
    fhir: {
      search: vi
        .fn()
        .mockResolvedValueOnce({ unbundle: () => graph })
        .mockResolvedValue({ unbundle: () => [] }),
    },
  } as never);
  const input = {
    body: JSON.stringify({ appointmentID: APPOINTMENT_ID }),
    headers,
    secrets: { ENVIRONMENT: 'testing' },
  } as unknown as ZambdaInput;
  return (index as unknown as (i: ZambdaInput) => Promise<{ statusCode: number; body: string }>)(input);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getQuestionnaireAndValueSets).mockResolvedValue({
    questionnaire: { resourceType: 'Questionnaire', status: 'active', item: [] },
    valueSets: [],
  });
  vi.mocked(resolveEffectiveQuestionnaire).mockImplementation(async (q) => q);
  vi.mocked(getUser).mockResolvedValue({ id: 'user-1' } as never);
  vi.mocked(userHasAccessToPatient).mockResolvedValue(true);
});

describe('get-paperwork', () => {
  test('reports an in-person visit as in-person when an annotation follow-up encounter comes first', async () => {
    const response = await invoke([
      ANNOTATION_FOLLOWUP_ENCOUNTER,
      IN_PERSON_ENCOUNTER,
      APPOINTMENT,
      PATIENT,
      LOCATION,
      QUESTIONNAIRE_RESPONSE,
    ]);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).appointment.serviceMode).toBe(ServiceMode['in-person']);
  });

  test('reports an in-person visit as in-person to the signed-in patient', async () => {
    const response = await invoke(
      [ANNOTATION_FOLLOWUP_ENCOUNTER, IN_PERSON_ENCOUNTER, APPOINTMENT, PATIENT, LOCATION, QUESTIONNAIRE_RESPONSE],
      { Authorization: 'Bearer patient-token' }
    );

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.appointment.serviceMode).toBe(ServiceMode['in-person']);
    expect(body.questionnaireResponse.id).toBe(QUESTIONNAIRE_RESPONSE.id);
  });

  test('still reports a telemed visit with an annotation follow-up as virtual', async () => {
    const virtualEncounter: Encounter = { ...IN_PERSON_ENCOUNTER, class: ANNOTATION_FOLLOWUP_ENCOUNTER.class };
    const response = await invoke([
      ANNOTATION_FOLLOWUP_ENCOUNTER,
      virtualEncounter,
      APPOINTMENT,
      PATIENT,
      LOCATION,
      QUESTIONNAIRE_RESPONSE,
    ]);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).appointment.serviceMode).toBe(ServiceMode.virtual);
  });
});
