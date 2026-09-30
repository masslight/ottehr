import Oystehr from '@oystehr/sdk';
import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { PRACTICE_MANAGED_QUESTIONNAIRE_TAG } from 'utils/lib/fhir/constants';
import { getCanonicalQuestionnaire, getQuestionnaireForQR } from 'utils/lib/fhir/questionnaires';
import { Secrets } from 'utils/lib/secrets';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUser } from '../../../shared/auth';
import { complexValidation, ValidatedInput } from './validation';

vi.mock('../../../shared/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../shared/auth')>();
  return { ...original, getUser: vi.fn() };
});

vi.mock('utils/lib/fhir/questionnaires', async (importOriginal) => {
  const original = await importOriginal<typeof import('utils/lib/fhir/questionnaires')>();
  return { ...original, getQuestionnaireForQR: vi.fn(), getCanonicalQuestionnaire: vi.fn() };
});

const mockGetUser = vi.mocked(getUser);
const mockQuestionnaireForQR = vi.mocked(getQuestionnaireForQR);
const mockCanonical = vi.mocked(getCanonicalQuestionnaire);

const QR_ID = '550e8400-e29b-41d4-a716-446655440000';
const PATIENT_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const FORM_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const OTHER_FORM_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3302';

const CUSTOM_FORM_PAGE = 'work-status-page';
const CONSENT_PAGE = 'consent-forms-page';

const EHR_USER = { id: 'staff-1', name: 'staff@example.com' } as never;
const PATIENT_USER = { id: 'patient-1', name: '+15555550123' } as never;

const questionnaireResponse: QuestionnaireResponse = {
  resourceType: 'QuestionnaireResponse',
  id: QR_ID,
  status: 'completed',
  subject: { reference: `Patient/${PATIENT_ID}` },
};

const oystehr = {
  fhir: { get: vi.fn().mockResolvedValue(questionnaireResponse) },
} as unknown as Oystehr;

const questionnaire = (overrides: Partial<Questionnaire>): Questionnaire => ({
  resourceType: 'Questionnaire',
  status: 'active',
  ...overrides,
});

const practiceManaged = (linkId: string, id = FORM_ID): Questionnaire =>
  questionnaire({
    id,
    meta: { tag: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG] },
    item: [{ linkId, type: 'group' }],
  });

const input = (pages: { linkId: string }[], questionnaireId = FORM_ID): ValidatedInput => ({
  body: { questionnaireResponseId: QR_ID, questionnaireId, patientId: PATIENT_ID, pages },
  callerAccessToken: 'token',
});

const validate = (pages: { linkId: string }[], questionnaireId?: string): Promise<unknown> =>
  complexValidation(input(pages, questionnaireId), {} as Secrets, oystehr);

beforeEach(() => {
  vi.clearAllMocks();
  (oystehr.fhir.get as ReturnType<typeof vi.fn>).mockResolvedValue(questionnaireResponse);
  mockGetUser.mockResolvedValue(EHR_USER);
  mockQuestionnaireForQR.mockResolvedValue(practiceManaged(CUSTOM_FORM_PAGE));
});

// These two zambdas are registered as `http_auth`, which any authenticated token in the project can
// invoke — including a patient's. Editing and deleting a submitted form are staff-only actions, so
// the gate has to be "is an EHR user", not "has access to this patient": a patient passes the latter
// for their own record and could otherwise rewrite or hide the form they were sent.
describe('update-visit-form authorization', () => {
  it('rejects a patient-app caller even when the response is their own', async () => {
    mockGetUser.mockResolvedValue(PATIENT_USER);

    await expect(validate([{ linkId: CUSTOM_FORM_PAGE }])).rejects.toMatchObject({ statusCode: 401 });
  });

  it('accepts an EHR user', async () => {
    await expect(validate([{ linkId: CUSTOM_FORM_PAGE }])).resolves.toMatchObject({ questionnaireResponse });
  });
});

// A paperwork-flow response is one resource shared by every form in the flow, so its item array also
// holds consent and the core intake pages. Without an allowlist a caller could address those pages by
// linkId and rewrite consent answers through the "edit this custom form" endpoint.
describe('update-visit-form editable page allowlist', () => {
  const flowQuestionnaire = questionnaire({ derivedFrom: ['http://example.org/custom-form|1.0.0'] });

  it('rejects a page that belongs to no practice-managed form in the flow', async () => {
    mockQuestionnaireForQR.mockResolvedValue(flowQuestionnaire);
    mockCanonical.mockResolvedValue(practiceManaged(CUSTOM_FORM_PAGE));

    await expect(validate([{ linkId: CONSENT_PAGE }])).rejects.toMatchObject({
      message: expect.stringContaining(CONSENT_PAGE),
    });
  });

  it('accepts a page belonging to a practice-managed form in the flow', async () => {
    mockQuestionnaireForQR.mockResolvedValue(flowQuestionnaire);
    mockCanonical.mockResolvedValue(practiceManaged(CUSTOM_FORM_PAGE));

    await expect(validate([{ linkId: CUSTOM_FORM_PAGE }])).resolves.toBeDefined();
  });

  it('skips flow members that are not practice-managed', async () => {
    mockQuestionnaireForQR.mockResolvedValue(flowQuestionnaire);
    mockCanonical.mockResolvedValue(questionnaire({ item: [{ linkId: CONSENT_PAGE, type: 'group' }] }));

    await expect(validate([{ linkId: CONSENT_PAGE }])).rejects.toMatchObject({
      message: expect.stringContaining(CONSENT_PAGE),
    });
  });

  // A standalone form owns its response outright, so every page in it belongs to that form.
  it('allows the response own pages when it is not a flow', async () => {
    await expect(validate([{ linkId: CUSTOM_FORM_PAGE }])).resolves.toBeDefined();
    expect(mockCanonical).not.toHaveBeenCalled();
  });

  it('rejects a standalone response when the caller names a different form', async () => {
    await expect(validate([{ linkId: CUSTOM_FORM_PAGE }], OTHER_FORM_ID)).rejects.toMatchObject({
      message: expect.stringContaining(CUSTOM_FORM_PAGE),
    });
  });
});

// A flow keeps one page per linkId, dropping all but the last form that declares it
// (handleFlowQuestionnaireItem), yet visit details still renders a card for every constituent form.
// So the response's `page` item is the surviving form's storage: without checking which form the
// save is for, the shadowed form's card would silently overwrite the surviving form's answers.
describe('update-visit-form page ownership within a flow', () => {
  const flowQuestionnaire = questionnaire({
    derivedFrom: ['http://example.org/shadowed|1.0.0', 'http://example.org/survivor|1.0.0'],
  });
  const SHARED_PAGE = 'page-one';

  beforeEach(() => {
    mockQuestionnaireForQR.mockResolvedValue(flowQuestionnaire);
    mockCanonical
      .mockResolvedValueOnce(practiceManaged(SHARED_PAGE, FORM_ID))
      .mockResolvedValueOnce(practiceManaged(SHARED_PAGE, OTHER_FORM_ID));
  });

  it('lets the last form that declares the page edit it', async () => {
    await expect(validate([{ linkId: SHARED_PAGE }], OTHER_FORM_ID)).resolves.toBeDefined();
  });

  it('refuses the earlier form whose page the flow dropped', async () => {
    await expect(validate([{ linkId: SHARED_PAGE }], FORM_ID)).rejects.toMatchObject({
      message: expect.stringContaining(SHARED_PAGE),
    });
  });
});

// get-visit-details resolves the flow's forms with allSettled and shows the ones that came back, so
// one unresolvable constituent must not make every card in the flow unsavable.
describe('update-visit-form with an unresolvable flow member', () => {
  const flowQuestionnaire = questionnaire({
    derivedFrom: ['http://example.org/missing|1.0.0', 'http://example.org/custom-form|1.0.0'],
  });

  it('still accepts a page from a form that did resolve', async () => {
    mockQuestionnaireForQR.mockResolvedValue(flowQuestionnaire);
    mockCanonical
      .mockRejectedValueOnce(new Error('Questionnaire not found'))
      .mockResolvedValueOnce(practiceManaged(CUSTOM_FORM_PAGE));

    await expect(validate([{ linkId: CUSTOM_FORM_PAGE }])).resolves.toBeDefined();
  });
});
