import { AIMessageChunk } from '@langchain/core/messages';
import { Appointment, Encounter, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { createOystehrClient } from 'utils/lib/helpers/helpers';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { index, INTERVIEW_COMPLETED, LANGUAGE_INSTRUCTION } from '../../src/patient/ai-interview/start';
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

const startInterview = async (appt: Appointment): Promise<string> => {
  const create = vi.fn(async (resource: QuestionnaireResponse) => resource);
  const search = vi
    .fn()
    .mockResolvedValueOnce({ unbundle: () => [ENCOUNTER, appt, PATIENT] })
    .mockResolvedValueOnce({ unbundle: () => [] });
  mockCreateClient.mockReturnValue({ fhir: { search, create } } as never);

  const result = await (index as unknown as (i: ZambdaInput) => Promise<{ statusCode: number }>)({
    body: JSON.stringify({ appointmentId: appt.id }),
    secrets: { ENVIRONMENT: 'testing', FHIR_API: 'fhir', PROJECT_API: 'project' },
  } as unknown as ZambdaInput);
  expect(result.statusCode).toBe(200);

  const prompt = mockInvokeChatbot.mock.calls[0][0][0] as { content: string };
  expect(create.mock.calls[0][0].item?.[0].answer?.[0].valueString).toBe(prompt.content);
  return prompt.content;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockInvokeChatbot.mockResolvedValue(new AIMessageChunk('Are you the patient?'));
});

describe('ai-interview-start', () => {
  test('keeps the completion marker untranslated so a non-English interview can still complete', () => {
    expect(LANGUAGE_INSTRUCTION).toContain(INTERVIEW_COMPLETED);
  });

  test.each([
    ['urgent care', undefined, 'urgent care visit'],
    ['workers comp', 'workers-comp', 'job related injury'],
  ])('tells the %s interviewer to reply in the patient language', async (_name, serviceCategoryCode, promptMarker) => {
    const prompt = await startInterview(appointment(serviceCategoryCode));
    expect(prompt).toContain(promptMarker);
    expect(prompt).toContain(LANGUAGE_INSTRUCTION);
  });
});
