import { MISSING_REQUEST_SECRETS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockCreateEncounterFromAppointment = vi.fn();
const mockGetAuth0Token = vi.fn().mockResolvedValue('test-token');
const mockCreateOystehrClient = vi.fn();
// hoisted to avoid dependency issues
const { mockGetOrCreateCandidApiClient } = vi.hoisted(() => ({
  mockGetOrCreateCandidApiClient: vi.fn(),
}));

const mockFhirPatch = vi.fn();
const mockFhirSearch = vi.fn();

const mockOystehrClient = {
  fhir: {
    patch: mockFhirPatch,
    search: mockFhirSearch,
    get: vi.fn(),
    create: vi.fn(),
  },
};

const mockGetAppointmentAndRelatedResources = vi.fn();

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createEncounterFromAppointment: mockCreateEncounterFromAppointment,
    getAuth0Token: mockGetAuth0Token,
    createClinicalOystehrClient: mockCreateOystehrClient,
    wrapHandler: (_name: string, handler: any) => handler,
    CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM: 'https://api.joincandidhealth.com/api/encounters/v4/response/encounter_id',
  };
});

vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getOrCreateCandidApiClient: mockGetOrCreateCandidApiClient,
  };
});

vi.mock('../../src/subscriptions/task/validateRequestParameters', () => ({
  validateRequestParameters: vi.fn(),
}));

vi.mock('../../src/shared/pdf/visit-details-pdf/get-video-resources', () => ({
  getAppointmentAndRelatedResources: (...args: any[]) => mockGetAppointmentAndRelatedResources(...args),
}));

vi.mock('@sentry/aws-serverless', () => ({
  captureException: vi.fn(),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────────

const { validateRequestParameters } = await import('../../src/subscriptions/task/validateRequestParameters');

const { index: _index } = await import('../../src/subscriptions/task/sub-send-claim/index');
const index = _index as unknown as (input: any) => Promise<{ statusCode: number; body: string }>;

const { createCandidDiagnoses } = await import('../../src/shared/candid');
const { DiagnosisTypeCode } = await import('candidhealth/api');

// ── Helpers ────────────────────────────────────────────────────────────────────

const CANDID_ENCOUNTER_ID_SYSTEM = 'https://api.joincandidhealth.com/api/encounters/v4/response/encounter_id';

function setupValidatedParams(taskId: string, appointmentId: string): void {
  vi.mocked(validateRequestParameters).mockReturnValue({
    task: {
      id: taskId,
      resourceType: 'Task',
      status: 'requested',
      intent: 'order',
      focus: {
        type: 'Appointment',
        reference: `Appointment/${appointmentId}`,
      },
    },
    secrets: {} as any,
  } as any);
}

function makeVisitResources(opts: {
  encounterId: string;
  existingCandidEncounterId?: string;
  hasIdentifiers?: boolean;
}): any {
  return {
    encounter: {
      resourceType: 'Encounter',
      id: opts.encounterId,
      status: 'finished',
      class: { code: 'AMB' },
      identifier: opts.existingCandidEncounterId
        ? [{ system: CANDID_ENCOUNTER_ID_SYSTEM, value: opts.existingCandidEncounterId }]
        : opts.hasIdentifiers === false
          ? undefined
          : [],
    },
    patient: {
      resourceType: 'Patient',
      id: 'patient-1',
      name: [{ given: ['Test'], family: 'Patient' }],
    },
    appointment: {
      resourceType: 'Appointment',
      id: 'appt-1',
      status: 'fulfilled',
    },
    practitioners: [
      {
        resourceType: 'Practitioner',
        id: 'pract-1',
        name: [{ given: ['Dr'], family: 'Test' }],
      },
    ],
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('sub-send-claim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateOystehrClient.mockReturnValue(mockOystehrClient);
    mockFhirPatch.mockResolvedValue({ resourceType: 'Task', id: 'task-1', status: 'completed' });
    // candid is configured by default, tests override to skip when needed
    mockGetOrCreateCandidApiClient.mockResolvedValue({} as any);
  });

  it('creates a Candid encounter and patches FHIR Encounter with the Candid ID', async () => {
    setupValidatedParams('task-1', 'appt-1');
    const visitResources = makeVisitResources({ encounterId: 'enc-1' });
    mockGetAppointmentAndRelatedResources.mockResolvedValue(visitResources);
    mockCreateEncounterFromAppointment.mockResolvedValue('candid-enc-abc');
    mockFhirPatch.mockResolvedValue({
      resourceType: 'Task',
      id: 'task-1',
      status: 'completed',
      statusReason: { coding: [{ code: 'claim sent successfully' }] },
    });

    const result = await index({ headers: {}, body: '{}', secrets: {} });

    expect(result.statusCode).toBe(200);
    expect(mockCreateEncounterFromAppointment).toHaveBeenCalledTimes(1);

    // Verify FHIR patch was called to add Candid encounter ID to the Encounter
    expect(mockFhirPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Encounter',
        id: 'enc-1',
        operations: expect.arrayContaining([
          expect.objectContaining({
            op: 'add',
            value: expect.objectContaining({
              system: CANDID_ENCOUNTER_ID_SYSTEM,
              value: 'candid-enc-abc',
            }),
          }),
        ]),
      })
    );
  });

  it('skips claim creation when Candid encounter ID already exists on the Encounter', async () => {
    setupValidatedParams('task-2', 'appt-2');
    const visitResources = makeVisitResources({
      encounterId: 'enc-2',
      existingCandidEncounterId: 'candid-enc-already-exists',
    });
    mockGetAppointmentAndRelatedResources.mockResolvedValue(visitResources);
    mockFhirPatch.mockResolvedValue({
      resourceType: 'Task',
      id: 'task-2',
      status: 'completed',
      statusReason: { coding: [{ code: 'claim sent successfully' }] },
    });

    const result = await index({ headers: {}, body: '{}', secrets: {} });

    expect(result.statusCode).toBe(200);
    // createEncounterFromAppointment should NOT be called
    expect(mockCreateEncounterFromAppointment).not.toHaveBeenCalled();
  });

  it('skips Candid when getOrCreateCandidApiClient rejects with MISSING_REQUEST_SECRETS', async () => {
    mockGetOrCreateCandidApiClient.mockRejectedValueOnce(MISSING_REQUEST_SECRETS);

    setupValidatedParams('task-3', 'appt-3');
    const visitResources = makeVisitResources({ encounterId: 'enc-3' });
    mockGetAppointmentAndRelatedResources.mockResolvedValue(visitResources);
    mockFhirPatch.mockResolvedValue({
      resourceType: 'Task',
      id: 'task-3',
      status: 'completed',
      statusReason: { coding: [{ code: 'claim sent successfully' }] },
    });

    const result = await index({ headers: {}, body: '{}', secrets: {} });

    expect(result.statusCode).toBe(200);
    expect(mockCreateEncounterFromAppointment).not.toHaveBeenCalled();
  });

  it('uses /identifier (array) when encounter has no existing identifiers', async () => {
    setupValidatedParams('task-4', 'appt-4');
    const visitResources = makeVisitResources({ encounterId: 'enc-4', hasIdentifiers: false });
    mockGetAppointmentAndRelatedResources.mockResolvedValue(visitResources);
    mockCreateEncounterFromAppointment.mockResolvedValue('candid-enc-new');
    mockFhirPatch.mockResolvedValue({
      resourceType: 'Task',
      id: 'task-4',
      status: 'completed',
      statusReason: { coding: [{ code: 'claim sent successfully' }] },
    });

    await index({ headers: {}, body: '{}', secrets: {} });

    // When encounter.identifier is undefined, patch uses /identifier with array value
    expect(mockFhirPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Encounter',
        id: 'enc-4',
        operations: expect.arrayContaining([
          expect.objectContaining({
            op: 'add',
            path: '/identifier',
            value: [
              expect.objectContaining({
                system: CANDID_ENCOUNTER_ID_SYSTEM,
                value: 'candid-enc-new',
              }),
            ],
          }),
        ]),
      })
    );
  });

  it('uses /identifier/- when encounter already has identifiers', async () => {
    setupValidatedParams('task-5', 'appt-5');
    const visitResources = makeVisitResources({ encounterId: 'enc-5' });
    // encounter.identifier = [] (defined but empty)
    mockGetAppointmentAndRelatedResources.mockResolvedValue(visitResources);
    mockCreateEncounterFromAppointment.mockResolvedValue('candid-enc-append');
    mockFhirPatch.mockResolvedValue({
      resourceType: 'Task',
      id: 'task-5',
      status: 'completed',
      statusReason: { coding: [{ code: 'claim sent successfully' }] },
    });

    await index({ headers: {}, body: '{}', secrets: {} });

    // When encounter.identifier exists (even empty array), patch uses /identifier/-
    expect(mockFhirPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Encounter',
        id: 'enc-5',
        operations: expect.arrayContaining([
          expect.objectContaining({
            op: 'add',
            path: '/identifier/-',
          }),
        ]),
      })
    );
  });

  it('marks task as completed on success', async () => {
    setupValidatedParams('task-6', 'appt-6');
    const visitResources = makeVisitResources({
      encounterId: 'enc-6',
      existingCandidEncounterId: 'already-done',
    });
    mockGetAppointmentAndRelatedResources.mockResolvedValue(visitResources);
    mockFhirPatch.mockResolvedValue({
      resourceType: 'Task',
      id: 'task-6',
      status: 'completed',
      statusReason: { coding: [{ system: 'status-reason', code: 'claim sent successfully' }] },
    });

    const result = await index({ headers: {}, body: '{}', secrets: {} });

    expect(result.statusCode).toBe(200);
    // Task patch for status update to 'completed'
    expect(mockFhirPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Task',
        id: 'task-6',
        operations: expect.arrayContaining([
          expect.objectContaining({
            op: 'replace',
            path: '/status',
            value: 'completed',
          }),
        ]),
      })
    );
  });

  it('throws when no appointment ID is found on task focus', async () => {
    vi.mocked(validateRequestParameters).mockReturnValue({
      task: {
        id: 'task-7',
        resourceType: 'Task',
        status: 'requested',
        intent: 'order',
        focus: {
          type: 'Patient',
          reference: 'Patient/patient-1',
        },
      },
      secrets: {} as any,
    } as any);

    await expect(index({ headers: {}, body: '{}', secrets: {} })).rejects.toThrow(
      'no appointment ID found on task focus'
    );
  });

  it('throws when visit resources are not found', async () => {
    setupValidatedParams('task-8', 'appt-8');
    mockGetAppointmentAndRelatedResources.mockResolvedValue(undefined);

    await expect(index({ headers: {}, body: '{}', secrets: {} })).rejects.toThrow(
      'Visit resources are not properly defined'
    );
  });

  it('handles null candidEncounterId from createEncounterFromAppointment (no patch ops)', async () => {
    setupValidatedParams('task-9', 'appt-9');
    const visitResources = makeVisitResources({ encounterId: 'enc-9' });
    mockGetAppointmentAndRelatedResources.mockResolvedValue(visitResources);
    mockCreateEncounterFromAppointment.mockResolvedValue(null);
    mockFhirPatch.mockResolvedValue({
      resourceType: 'Task',
      id: 'task-9',
      status: 'completed',
      statusReason: { coding: [{ code: 'claim sent successfully' }] },
    });

    const result = await index({ headers: {}, body: '{}', secrets: {} });

    expect(result.statusCode).toBe(200);
    // The Encounter patch should still happen but with empty operations array
    expect(mockFhirPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Encounter',
        id: 'enc-9',
        operations: [],
      })
    );
  });
});

describe('createCandidDiagnoses', () => {
  function makeCondition(id: string, code: string): any {
    return {
      resourceType: 'Condition',
      id,
      code: { coding: [{ code }] },
    };
  }

  it('emits the primary diagnosis as Abk and secondaries as Abf', () => {
    const encounter: any = {
      resourceType: 'Encounter',
      diagnosis: [
        { condition: { reference: 'Condition/primary' }, rank: 1 },
        { condition: { reference: 'Condition/secondary' }, rank: 2 },
      ],
    };
    const diagnoses = [makeCondition('primary', 'A00'), makeCondition('secondary', 'B00')];

    const result = createCandidDiagnoses(encounter, diagnoses);

    expect(result).toEqual(
      expect.arrayContaining([
        { codeType: DiagnosisTypeCode.Abk, code: 'A00' },
        { codeType: DiagnosisTypeCode.Abf, code: 'B00' },
      ])
    );
    expect(result).toHaveLength(2);
  });

  it('keeps the primary diagnosis (Abk) when the same code is also entered as a secondary listed first', () => {
    // Regression: the duplicate secondary appears before the primary in encounter.diagnosis.
    // Without the primary-first ordering, the secondary would claim the code first and the
    // primary would be deduped away, leaving no Abk entry -> "Primary diagnosis is absent".
    const encounter: any = {
      resourceType: 'Encounter',
      diagnosis: [
        { condition: { reference: 'Condition/secondary' }, rank: 2 },
        { condition: { reference: 'Condition/primary' }, rank: 1 },
      ],
    };
    const diagnoses = [makeCondition('secondary', 'A00'), makeCondition('primary', 'A00')];

    const result = createCandidDiagnoses(encounter, diagnoses);

    // The duplicate code collapses to a single entry, and it must be the primary.
    expect(result).toEqual([{ codeType: DiagnosisTypeCode.Abk, code: 'A00' }]);
    expect(result.some((diagnosis) => diagnosis.codeType === DiagnosisTypeCode.Abk)).toBe(true);
  });
});
