import { AIMessageChunk } from '@langchain/core/messages';
import { Appointment, Encounter, Patient, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { createOystehrClient } from 'utils/lib/helpers/helpers';
import { AI_QUESTIONNAIRE_ID } from 'utils/lib/types/constants';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { index as handleAnswer } from '../../src/patient/ai-interview/handle-answer';
import {
  CLOSING_INSTRUCTION,
  index as start,
  INTERVIEW_COMPLETED,
  LANGUAGE_INSTRUCTION,
} from '../../src/patient/ai-interview/start';
import { invokeChatbot } from '../../src/shared/ai';
import { ZambdaInput } from '../../src/shared/types/common';

vi.mock('../../src/shared/getAuth0Token', () => ({ getAuth0Token: vi.fn().mockResolvedValue('m2m-token') }));

vi.mock('../../src/shared/ai', () => ({ invokeChatbot: vi.fn() }));

vi.mock('utils/lib/helpers/helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('utils/lib/helpers/helpers')>();
  return { ...original, createOystehrClient: vi.fn() };
});

const mockCreateClient = vi.mocked(createOystehrClient);
const mockInvokeChatbot = vi.mocked(invokeChatbot);

const ENCOUNTER: Encounter = { resourceType: 'Encounter', id: 'enc-1', status: 'planned', class: { code: 'AMB' } };
const PATIENT: Patient = { resourceType: 'Patient', id: 'pat-1', name: [{ given: ['Katie'], family: 'Doe' }] };

const appointment = (serviceCategoryCode?: string): Appointment => ({
  resourceType: 'Appointment',
  id: 'appt-1',
  status: 'booked',
  participant: [{ status: 'accepted' }],
  ...(serviceCategoryCode && {
    serviceCategory: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: serviceCategoryCode }] }],
  }),
});

const inProgressInterview = (): QuestionnaireResponse => ({
  resourceType: 'QuestionnaireResponse',
  id: 'qr-1',
  status: 'in-progress',
  item: [{ linkId: '0', answer: [{ valueString: 'Initial prompt' }] }],
  contained: [
    {
      resourceType: 'Questionnaire',
      id: AI_QUESTIONNAIRE_ID,
      status: 'active',
      item: [
        { linkId: '0', text: 'Initial message', type: 'text' },
        { linkId: '1', text: 'Are you the patient?', type: 'text' },
      ],
    },
  ],
});

const invoke = async (handler: unknown, body: object): Promise<void> => {
  const result = await (handler as (i: ZambdaInput) => Promise<{ statusCode: number }>)({
    body: JSON.stringify(body),
    secrets: { ENVIRONMENT: 'testing', FHIR_API: 'fhir', PROJECT_API: 'project' },
  } as unknown as ZambdaInput);
  expect(result.statusCode).toBe(200);
};

const startInterview = async (appt: Appointment): Promise<string> => {
  const create = vi.fn(async (resource: QuestionnaireResponse) => resource);
  const search = vi
    .fn()
    .mockResolvedValueOnce({ unbundle: () => [ENCOUNTER, appt, PATIENT] })
    .mockResolvedValueOnce({ unbundle: () => [] });
  mockCreateClient.mockReturnValue({ fhir: { search, create } } as never);

  await invoke(start, { appointmentId: appt.id });

  const prompt = mockInvokeChatbot.mock.calls[0][0][0] as { content: string };
  expect(create.mock.calls[0][0].item?.[0].answer?.[0].valueString).toBe(prompt.content);
  return prompt.content;
};

const answerInterview = async (chatbotResponse: string): Promise<QuestionnaireResponse> => {
  mockInvokeChatbot.mockResolvedValue(new AIMessageChunk(chatbotResponse));
  const update = vi.fn(async (resource: QuestionnaireResponse) => resource);
  mockCreateClient.mockReturnValue({
    fhir: { get: vi.fn().mockResolvedValue(inProgressInterview()), update },
  } as never);

  await invoke(handleAnswer, { questionnaireResponseId: 'qr-1', linkId: '1', answer: 'Soy su madre.' });

  return update.mock.calls[0][0];
};

const lastQuestionText = (questionnaireResponse: QuestionnaireResponse): string | undefined =>
  (questionnaireResponse.contained?.[0] as Questionnaire).item?.find((item) => item.linkId === '2')?.text;

beforeEach(() => {
  vi.clearAllMocks();
  mockInvokeChatbot.mockResolvedValue(new AIMessageChunk('Are you the patient?'));
});

describe('ai-interview-start', () => {
  test('keeps the completion marker untranslated so a non-English interview can still complete', () => {
    expect(CLOSING_INSTRUCTION).toContain(`"${INTERVIEW_COMPLETED}" untranslated`);
  });

  test.each([
    ['urgent care', undefined, 'urgent care visit'],
    ['workers comp', 'workers-comp', 'job related injury'],
  ])('tells the %s interviewer to reply in the patient language', async (_name, serviceCategoryCode, promptMarker) => {
    const prompt = await startInterview(appointment(serviceCategoryCode));
    expect(prompt).toContain(promptMarker);
    expect(prompt).toContain(LANGUAGE_INSTRUCTION);
    expect(prompt).toContain(CLOSING_INSTRUCTION);
  });
});

describe('handle-answer', () => {
  test('completes the interview and hides the completion marker from the patient', async () => {
    const updated = await answerInterview(`No tengo más preguntas. La entrevista ha terminado. ${INTERVIEW_COMPLETED}`);
    expect(updated.status).toBe('completed');
    expect(lastQuestionText(updated)).toBe('No tengo más preguntas. La entrevista ha terminado.');
  });

  test('keeps the interview in progress while the chatbot is still asking questions', async () => {
    const updated = await answerInterview('¿Cuándo comenzó la erupción?');
    expect(updated.status).toBe('in-progress');
    expect(lastQuestionText(updated)).toBe('¿Cuándo comenzó la erupción?');
  });
});
