import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockOystehrClient = {
  fhir: {
    search: vi.fn(),
    patch: vi.fn(),
  },
};

vi.mock('@sentry/aws-serverless', () => ({
  captureException: vi.fn(),
}));

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createOystehrClient: vi.fn(() => mockOystehrClient),
    getCandidEncounterIdFromEncounter: vi.fn().mockReturnValue('candid-enc-1'),
    wrapHandler: (_name: string, fn: any) => fn,
  };
});

const mockItemize = vi.fn();
const mockCreateCandidApiClient = vi.fn(() => ({
  patientAr: {
    v1: {
      itemize: mockItemize,
    },
  },
}));
const mockFindClaimsBy = vi.fn();

vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createCandidApiClient: mockCreateCandidApiClient,
    findClaimsBy: mockFindClaimsBy,
  };
});

vi.mock('../../src/subscriptions/task/sub-refresh-invoice-task/validateRequestParameters', () => ({
  validateRequestParameters: vi.fn(),
}));

const { validateRequestParameters } = await import(
  '../../src/subscriptions/task/sub-refresh-invoice-task/validateRequestParameters'
);
const { index: _index } = await import('../../src/subscriptions/task/sub-refresh-invoice-task');
const index = _index as unknown as (input: any) => Promise<{ statusCode: number; body: string }>;

const okItemization = (claimId: string, patientBalanceCents: number): any => ({
  ok: true,
  body: {
    claimId,
    patientBalanceCents,
  },
  rawResponse: {
    status: 200,
    headers: new Headers(),
  },
});

const tooManyRequestsResponse = (): any => ({
  ok: false,
  error: {
    errorName: 'TooManyRequestsError',
  },
  rawResponse: {
    status: 429,
    headers: new Headers(),
  },
});

describe('sub-refresh-invoice-task', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries a 429 itemize response and completes the task update', async () => {
    vi.mocked(validateRequestParameters).mockReturnValue({
      task: {
        id: 'task-1',
        resourceType: 'Task',
        status: 'requested',
        intent: 'order',
      },
      secrets: {} as any,
      taskId: 'task-1',
      invoiceTaskInput: {
        amountCents: 0,
        claimId: '',
      } as any,
    } as any);

    mockOystehrClient.fhir.search.mockResolvedValueOnce({
      unbundle: () => [
        {
          resourceType: 'Encounter',
          id: 'enc-1',
          statusHistory: [
            {
              status: 'arrived',
              period: {
                start: '2026-05-01T10:00:00Z',
              },
            },
          ],
        },
      ],
    });
    mockOystehrClient.fhir.patch.mockResolvedValueOnce({});

    mockFindClaimsBy.mockResolvedValueOnce([
      {
        encounterId: 'candid-enc-1',
        claimId: 'claim-abc',
        timestamp: new Date('2026-05-01T10:00:00Z'),
      },
    ]);

    mockItemize
      .mockResolvedValueOnce(tooManyRequestsResponse())
      .mockResolvedValueOnce(okItemization('claim-abc', 7777));

    const promise = index({
      secrets: {},
      headers: null,
      body: null,
    } as any);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.statusCode).toBe(200);
    expect(mockItemize).toHaveBeenCalledTimes(2);
    expect(mockOystehrClient.fhir.patch).toHaveBeenCalledTimes(1);
    const patchArg = mockOystehrClient.fhir.patch.mock.calls[0][0];
    const replaceInputOp = patchArg.operations.find((op: any) => op.op === 'replace' && op.path === '/input');
    expect(replaceInputOp).toBeDefined();
  });
});
