import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSearch, mockGet, mockCreate, mockSendSms } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockGet: vi.fn(),
  mockCreate: vi.fn(),
  mockSendSms: vi.fn(),
}));

vi.mock('../../src/shared/auth', () => ({ checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('m2m') }));
vi.mock('../../src/shared/helpers', () => ({
  createClinicalOystehrClient: () => ({ fhir: { search: mockSearch, get: mockGet, create: mockCreate } }),
}));
vi.mock('../../src/shared/practitioners', () => ({ getMyPractitionerId: vi.fn().mockResolvedValue('prac-1') }));
vi.mock('../../src/shared/communication', () => ({ sendSmsForPatient: mockSendSms }));

import { QR_DISTRIBUTION_TAG } from 'utils/lib/fhir/constants';
import { FOLLOWUP_SYSTEMS } from 'utils/lib/fhir/encounter';
import { index } from '../../src/ehr/send-patient-form';

const APPOINTMENT_ID = '11111111-1111-4111-8111-111111111111';
const QUESTIONNAIRE_ID = '22222222-2222-4222-8222-222222222222';
const MAIN_ENCOUNTER = '33333333-3333-4333-8333-333333333333';
const FOLLOW_UP_ENCOUNTER = '44444444-4444-4444-8444-444444444444';

const call = async (body: Record<string, unknown>): Promise<{ statusCode: number; body: string }> =>
  (await index(
    {
      body: JSON.stringify({ appointmentId: APPOINTMENT_ID, questionnaireId: QUESTIONNAIRE_ID, ...body }),
      headers: { Authorization: 'Bearer user-token' },
      secrets: { WEBSITE_URL: 'https://patient.example.test', ENVIRONMENT: 'test' },
    } as never,
    {} as never,
    () => undefined
  )) as { statusCode: number; body: string };

describe('send-patient-form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation(async ({ resourceType }: { resourceType: string }) =>
      resourceType === 'Questionnaire'
        ? {
            resourceType,
            id: QUESTIONNAIRE_ID,
            url: 'phq9',
            version: '1.0.0',
            title: 'PHQ-9',
            status: 'active',
            item: [],
          }
        : { resourceType, id: 'prac-1', name: [{ given: ['Sam'], family: 'Stone' }] }
    );
    mockSearch.mockResolvedValue({
      unbundle: () => [
        // The follow-up note comes back first, as the search may return it.
        {
          resourceType: 'Encounter',
          id: FOLLOW_UP_ENCOUNTER,
          status: 'in-progress',
          class: { code: 'AMB' },
          partOf: { reference: `Encounter/${MAIN_ENCOUNTER}` },
          type: [{ coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }] }],
        },
        { resourceType: 'Encounter', id: MAIN_ENCOUNTER, status: 'in-progress', class: { code: 'AMB' } },
        { resourceType: 'Patient', id: 'patient-1' },
      ],
    });
    mockCreate.mockImplementation(async (qr: Record<string, unknown>) => ({ ...qr, id: 'new-qr' }));
  });

  it('texts the patient a link by default', async () => {
    const result = await call({});

    expect(result.statusCode).toBe(200);
    expect(mockSendSms).toHaveBeenCalledTimes(1);
  });

  it('starts the response without texting when filling it out now', async () => {
    const result = await call({ notifyPatient: false });

    expect(JSON.parse(result.body)).toEqual({ questionnaireResponseId: 'new-qr' });
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it("attaches to the visit's own encounter, never an attached follow-up note, when none is given", async () => {
    await call({ notifyPatient: false });

    expect(mockCreate.mock.calls[0][0].encounter).toEqual({ reference: `Encounter/${MAIN_ENCOUNTER}` });
  });

  it('attaches to the encounter on screen when one is given', async () => {
    await call({ notifyPatient: false, encounterId: FOLLOW_UP_ENCOUNTER });

    expect(mockCreate.mock.calls[0][0].encounter).toEqual({ reference: `Encounter/${FOLLOW_UP_ENCOUNTER}` });
  });

  it('reuses an unfinished response only from the same encounter', async () => {
    const unfinished = (id: string, encounterId: string): Record<string, unknown> => ({
      resourceType: 'QuestionnaireResponse',
      id,
      status: 'in-progress',
      questionnaire: 'phq9|1.0.0',
      encounter: { reference: `Encounter/${encounterId}` },
      meta: { tag: [QR_DISTRIBUTION_TAG] },
    });
    const { unbundle } = await mockSearch();
    mockSearch.mockResolvedValue({
      unbundle: () => [
        ...unbundle(),
        unfinished('qr-follow-up', FOLLOW_UP_ENCOUNTER),
        unfinished('qr-main', MAIN_ENCOUNTER),
      ],
    });

    const result = await call({ notifyPatient: false });

    expect(JSON.parse(result.body)).toEqual({ questionnaireResponseId: 'qr-main' });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
