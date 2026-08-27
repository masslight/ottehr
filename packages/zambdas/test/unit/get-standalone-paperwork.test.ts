import { Appointment, Encounter, Patient, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { PRACTICE_MANAGED_QUESTIONNAIRE_TAG } from 'utils/lib/fhir/constants';
import { getQuestionnaireForQR } from 'utils/lib/fhir/questionnaires';
import { MANAGED_QUESTIONNAIRE_ERROR, NO_READ_ACCESS_TO_PATIENT_ERROR } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { index } from '../../src/patient/paperwork/get-standalone-paperwork';
import { getUser, userHasAccessToPatient } from '../../src/shared/auth';
import { createClinicalOystehrClient } from '../../src/shared/helpers';
import { ZambdaInput } from '../../src/shared/types/common';

/**
 * First tests of any kind for get-standalone-paperwork — the endpoint that serves
 * practice-managed (standalone) forms to patients. Covers input validation, the
 * patient-access authorization gate, the managed-questionnaire tag gate, the resource
 * graph requirements, and the response shape. The FHIR client and auth helpers are
 * mocked; questionnaire item mapping and response assembly run for real.
 */

vi.mock('@sentry/aws-serverless', async (importOriginal) => {
  const original = await importOriginal<typeof import('@sentry/aws-serverless')>();
  return { ...original, wrapHandler: (handler: unknown) => handler, captureException: vi.fn() };
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

vi.mock('utils/lib/fhir/questionnaires', async (importOriginal) => {
  const original = await importOriginal<typeof import('utils/lib/fhir/questionnaires')>();
  return { ...original, getQuestionnaireForQR: vi.fn() };
});

const mockCreateClient = vi.mocked(createClinicalOystehrClient);
const mockGetUser = vi.mocked(getUser);
const mockUserHasAccess = vi.mocked(userHasAccessToPatient);
const mockGetQuestionnaireForQR = vi.mocked(getQuestionnaireForQR);

const QR_ID = '550e8400-e29b-41d4-a716-446655440000';

const questionnaireResponse = (overrides: Partial<QuestionnaireResponse> = {}): QuestionnaireResponse => ({
  resourceType: 'QuestionnaireResponse',
  id: QR_ID,
  status: 'in-progress',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  item: [],
  ...overrides,
});

const managedQuestionnaire = (managed = true): Questionnaire => ({
  resourceType: 'Questionnaire',
  id: 'q-1',
  status: 'active',
  title: 'Injury Follow-Up Form',
  ...(managed ? { meta: { tag: [{ ...PRACTICE_MANAGED_QUESTIONNAIRE_TAG }] } } : {}),
  item: [
    {
      linkId: 'follow-up-page',
      type: 'group',
      item: [{ linkId: 'pain-level', type: 'string', text: 'Current pain level' }],
    },
  ],
});

const GRAPH_ENCOUNTER: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'finished',
  class: { code: 'AMB' },
};
const GRAPH_APPOINTMENT: Appointment = {
  resourceType: 'Appointment',
  id: 'appt-1',
  status: 'fulfilled',
  start: '2026-08-01T15:00:00Z',
  participant: [{ status: 'accepted' }],
};
const GRAPH_PATIENT: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [{ given: ['Pat', 'Quincy'], family: 'Doe' }],
  birthDate: '1990-05-01',
  gender: 'female',
};

interface OystehrMock {
  fhir: { get: ReturnType<typeof vi.fn>; search: ReturnType<typeof vi.fn> };
}

const makeOystehr = (qr: QuestionnaireResponse, graph: unknown[] = []): OystehrMock => ({
  fhir: {
    get: vi.fn().mockResolvedValue(qr),
    search: vi.fn().mockResolvedValue({ unbundle: () => graph }),
  },
});

const invoke = async (
  oystehr: OystehrMock,
  body: unknown = { questionnaireResponseId: QR_ID }
): Promise<{ statusCode: number; body: string }> => {
  mockCreateClient.mockReturnValue(oystehr as never);
  const input = {
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { Authorization: 'Bearer patient-token' },
    secrets: { ENVIRONMENT: 'testing' },
  } as unknown as ZambdaInput;
  return (index as unknown as (i: ZambdaInput) => Promise<{ statusCode: number; body: string }>)(input);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ id: 'user-1' } as never);
  mockUserHasAccess.mockResolvedValue(true);
  mockGetQuestionnaireForQR.mockResolvedValue(managedQuestionnaire());
});

describe('get-standalone-paperwork', () => {
  const fullGraph = [GRAPH_ENCOUNTER, GRAPH_APPOINTMENT, GRAPH_PATIENT];

  test('returns the mapped items, patient summary, and questionnaire title', async () => {
    const result = await invoke(makeOystehr(questionnaireResponse(), fullGraph));
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.questionnaireTitle).toBe('Injury Follow-Up Form');
    expect(body.allItems).toHaveLength(1);
    expect(body.allItems[0].linkId).toBe('follow-up-page');
    // extensions are structured into typed props by the mapper
    expect(body.allItems[0].item[0]).toMatchObject({ linkId: 'pain-level', type: 'string' });
    expect(body.patient).toMatchObject({
      id: 'pat-1',
      firstName: 'Pat',
      middleName: 'Quincy',
      lastName: 'Doe',
      dateOfBirth: '1990-05-01',
      sex: 'Female',
    });
    expect(body.appointment).toMatchObject({ id: 'appt-1', serviceMode: 'in-person' });
    expect(body.questionnaireResponse.id).toBe(QR_ID);
  });

  test('rejects a request without a valid questionnaireResponseId', async () => {
    const oystehr = makeOystehr(questionnaireResponse(), fullGraph);
    const missing = await invoke(oystehr, {});
    expect(missing.statusCode).toBeGreaterThanOrEqual(400);
    const notUuid = await invoke(oystehr, { questionnaireResponseId: 'not-a-uuid' });
    expect(notUuid.statusCode).toBeGreaterThanOrEqual(400);
    expect(oystehr.fhir.get).not.toHaveBeenCalled();
  });

  // Internal invariant failures (plain Error throws) surface as a generic body: the
  // wrapper deliberately does not leak internal messages to the caller.
  test('fails closed with a generic internal error when the QR subject is not a Patient', async () => {
    const oystehr = makeOystehr(questionnaireResponse({ subject: { reference: 'Group/team-1' } }), fullGraph);
    const result = await invoke(oystehr);
    expect(result.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.parse(result.body)).toEqual({ error: 'Internal error' });
    // and it fails before any authorization or questionnaire work happens
    expect(mockGetQuestionnaireForQR).not.toHaveBeenCalled();
  });

  test('denies callers without access to the patient', async () => {
    mockUserHasAccess.mockResolvedValue(false);
    const result = await invoke(makeOystehr(questionnaireResponse(), fullGraph));
    expect(result.statusCode).toBeGreaterThanOrEqual(400);
    expect(result.body).toContain(NO_READ_ACCESS_TO_PATIENT_ERROR.code);
    expect(mockGetQuestionnaireForQR).not.toHaveBeenCalled();
  });

  test('denies unauthenticated callers outright', async () => {
    mockCreateClient.mockReturnValue(makeOystehr(questionnaireResponse(), fullGraph) as never);
    const input = {
      body: JSON.stringify({ questionnaireResponseId: QR_ID }),
      headers: {},
      secrets: { ENVIRONMENT: 'testing' },
    } as unknown as ZambdaInput;
    const result = await (index as unknown as (i: ZambdaInput) => Promise<{ statusCode: number; body: string }>)(input);
    expect(result.statusCode).toBeGreaterThanOrEqual(400);
    expect(result.body).toContain(NO_READ_ACCESS_TO_PATIENT_ERROR.code);
    expect(mockUserHasAccess).not.toHaveBeenCalled();
  });

  test('rejects questionnaires that are not practice-managed', async () => {
    mockGetQuestionnaireForQR.mockResolvedValue(managedQuestionnaire(false));
    const result = await invoke(makeOystehr(questionnaireResponse(), fullGraph));
    expect(result.statusCode).toBeGreaterThanOrEqual(400);
    expect(result.body).toContain('not compatible with the standalone form path');
    expect(result.body).toContain(MANAGED_QUESTIONNAIRE_ERROR('x').code);
  });

  test('fails closed when the QR has no encounter to anchor the resource graph', async () => {
    const result = await invoke(makeOystehr(questionnaireResponse({ encounter: undefined }), fullGraph));
    expect(result.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.parse(result.body)).toEqual({ error: 'Internal error' });
  });

  test('errors when the encounter graph is missing the patient', async () => {
    const result = await invoke(makeOystehr(questionnaireResponse(), [GRAPH_ENCOUNTER, GRAPH_APPOINTMENT]));
    expect(result.statusCode).toBeGreaterThanOrEqual(400);
    expect(result.body).toContain('No patient found for Encounter/enc-1');
  });
});
