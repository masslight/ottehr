import type { APIGatewayProxyResult } from 'aws-lambda';
import type { Operation } from 'fast-json-patch';
import { Task, TaskInput } from 'fhir/r4b';
import {
  INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
  invoiceTaskSourceTag,
  RcmTaskCodings,
  ZERO_BALANCE_BUSINESS_STATUS,
  ZERO_BALANCE_BUSINESS_STATUS_CODE,
} from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

const mockZambdaExecute = vi.fn();
const mockClinicalClient = {
  fhir: {
    search: vi.fn(),
    patch: vi.fn(),
    get: vi.fn(),
  },
  zambda: {
    execute: (...args: unknown[]) => mockZambdaExecute(...args),
  },
};
const mockGetOrCreateCandidApiClient = vi.fn();

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createClinicalOystehrClient: vi.fn(() => mockClinicalClient),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getOrCreateCandidApiClient: (...args: unknown[]) => mockGetOrCreateCandidApiClient(...args),
  };
});

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

let handler!: ZambdaHandler;

const billingTask = (overrides: Partial<Task> = {}): Task =>
  ({
    resourceType: 'Task',
    id: 'task-1',
    status: 'requested',
    intent: 'order',
    code: RcmTaskCodings.sendInvoiceToPatient,
    encounter: {
      reference: 'Encounter/enc-1',
    },
    authoredOn: '2026-07-01T00:00:00Z',
    meta: {
      tag: [invoiceTaskSourceTag('ottehr-billing')],
    },
    identifier: [
      {
        system: INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
        value: 'claim-1',
      },
    ],
    ...overrides,
  }) as Task;

const arItem = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  claimId: 'claim-1',
  patientId: 'pat-1',
  patientName: 'Test, Katie',
  patientDob: '1990-01-15',
  encounterId: 'enc-1',
  appointmentId: 'appt-1',
  serviceDate: '2026-07-01',
  finalizationDate: '2026-07-10T12:00:00.000Z',
  billed: 100,
  allowed: 80,
  insurancePaid: 54.5,
  patientResp: 25.5,
  patientPaid: 0,
  balance: 25.5,
  adjudicated: true,
  ...overrides,
});

/**
 * `task` is the subscription payload; `storedTask` is what the handler will read back from FHIR
 * right before patching. They differ when a concurrent write has moved the resource on.
 */
const runHandler = (task: Task, storedTask: Task = task): Promise<APIGatewayProxyResult> => {
  mockClinicalClient.fhir.get.mockResolvedValue(storedTask);
  return handler({
    headers: null,
    body: JSON.stringify(task),
    secrets: {
      PROJECT_ID: 'test-project',
    },
  });
};

const patchedOperations = (callIndex = 0): Operation[] =>
  mockClinicalClient.fhir.patch.mock.calls[callIndex][0].operations as Operation[];

const patchedInputEntry = (code: string): TaskInput | undefined => {
  const inputOp = patchedOperations().find((op) => op.path === '/input') as { value: TaskInput[] } | undefined;
  return inputOp?.value.find((entry) => entry.type.coding?.some((coding) => coding.code === code));
};

const nonZeroBalanceAr = (): void => {
  mockZambdaExecute.mockResolvedValue({
    output: {
      claims: [arItem()],
      total: 1,
      offset: 0,
      pageSize: 25,
    },
  });
};

describe('sub-refresh-invoice-task', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockClinicalClient.fhir.patch.mockResolvedValue({});
    ({ index: handler } = (await import('../../src/subscriptions/task/sub-refresh-invoice-task/index')) as unknown as {
      index: ZambdaHandler;
    });
  });

  it('refreshes a billing-sourced task from patient AR without touching Candid', async () => {
    mockZambdaExecute.mockResolvedValue({
      output: {
        claims: [arItem()],
        total: 1,
        offset: 0,
        pageSize: 25,
      },
    });

    const result = await runHandler(billingTask());

    expect(JSON.parse(result.body).message).toContain('successfully updated');
    expect(mockGetOrCreateCandidApiClient).not.toHaveBeenCalled();
    expect(mockZambdaExecute).toHaveBeenCalledWith({
      id: 'search-billing-patient-ar-claims',
      claimIds: ['claim-1'],
      includeZeroBalance: true,
    });

    expect(patchedInputEntry('amountCents')?.valueString).toBe('2550');
    const authoredOnOp = patchedOperations().find((op) => op.path === '/authoredOn') as
      | {
          op: string;
          value: string;
        }
      | undefined;
    expect(authoredOnOp).toEqual(
      expect.objectContaining({
        op: 'replace',
        value: '2026-07-10T12:00:00.000Z',
      })
    );
    const statusOp = patchedOperations().find((op) => op.path === '/status') as { value: string } | undefined;
    expect(statusOp?.value).toBe('ready');
  });

  it('marks a billing task zero-balance when the claim balance drops to $0', async () => {
    mockZambdaExecute.mockResolvedValue({
      output: {
        claims: [
          arItem({
            balance: 0,
          }),
        ],
        total: 1,
        offset: 0,
        pageSize: 25,
      },
    });

    await runHandler(billingTask());

    const businessStatusOp = patchedOperations().find((op) => op.path === '/businessStatus') as
      | {
          op: string;
          value: {
            coding: {
              code: string;
            }[];
          };
        }
      | undefined;
    expect(businessStatusOp?.op).toBe('add');
    expect(businessStatusOp?.value.coding[0].code).toBe(ZERO_BALANCE_BUSINESS_STATUS_CODE);
  });

  it('fails a billing task whose claim left patient AR', async () => {
    mockZambdaExecute.mockResolvedValue({
      output: {
        claims: [],
        total: 0,
        offset: 0,
        pageSize: 25,
      },
    });

    const result = await runHandler(billingTask());

    expect(JSON.parse(result.body).message).toContain('no patient AR claim');
    expect(patchedOperations()).toEqual([
      {
        op: 'replace',
        path: '/status',
        value: 'failed',
      },
    ]);
  });

  it('skips the businessStatus removal when the stored task no longer carries one', async () => {
    nonZeroBalanceAr();

    // A duplicate delivery: the payload still shows the zero-balance flag an earlier run removed.
    await runHandler(billingTask({ businessStatus: ZERO_BALANCE_BUSINESS_STATUS }), billingTask());

    expect(mockClinicalClient.fhir.patch).toHaveBeenCalledTimes(1);
    expect(patchedOperations().find((op) => op.path === '/businessStatus')).toBeUndefined();
  });

  it('adds rather than replaces paths the stored task is missing', async () => {
    nonZeroBalanceAr();

    await runHandler(billingTask(), billingTask({ authoredOn: undefined }));

    const authoredOnOp = patchedOperations().find((op) => op.path === '/authoredOn') as { op: string } | undefined;
    expect(authoredOnOp?.op).toBe('add');
  });

  // The FHIR API's exact rejection for a patch against a missing path is a server detail, and it is
  // reported on `code` or `statusCode` depending on how the SDK wrapped it — so all of these shapes
  // have to reach the retry.
  it.each([
    { label: 'code 422', rejection: { code: 422 } },
    { label: 'code 400', rejection: { code: 400 } },
    { label: 'statusCode 422', rejection: { statusCode: 422 } },
  ])('retries without the remove operation when the patch is rejected with $label', async ({ rejection }) => {
    nonZeroBalanceAr();
    mockClinicalClient.fhir.patch
      .mockRejectedValueOnce(Object.assign(new Error('path that does not exist'), rejection))
      .mockResolvedValueOnce({});

    const taskWithZeroBalanceFlag = billingTask({ businessStatus: ZERO_BALANCE_BUSINESS_STATUS });
    const result = await runHandler(taskWithZeroBalanceFlag);

    expect(patchedOperations(0)).toContainEqual({ op: 'remove', path: '/businessStatus' });

    const retriedOperations = patchedOperations(1);
    expect(retriedOperations.some((op) => op.op === 'remove')).toBe(false);
    expect(retriedOperations).toContainEqual({ op: 'replace', path: '/status', value: 'ready' });
    expect(retriedOperations.some((op) => op.path === '/input')).toBe(true);

    // A retry that succeeded still gave up on clearing businessStatus; the response has to say so.
    const message = JSON.parse(result.body).message as string;
    expect(message).toContain('successfully updated');
    expect(message).toContain('remove /businessStatus');
  });

  it('reports an unqualified success when nothing had to be dropped', async () => {
    nonZeroBalanceAr();

    const result = await runHandler(billingTask({ businessStatus: ZERO_BALANCE_BUSINESS_STATUS }));

    expect(mockClinicalClient.fhir.patch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(result.body).message).toBe('Task was successfully updated.');
  });

  it('propagates patch failures that are not path rejections', async () => {
    nonZeroBalanceAr();
    mockClinicalClient.fhir.patch.mockRejectedValue(Object.assign(new Error('conflict'), { code: 409 }));

    await expect(runHandler(billingTask({ businessStatus: ZERO_BALANCE_BUSINESS_STATUS }))).rejects.toThrow('conflict');
    expect(mockClinicalClient.fhir.patch).toHaveBeenCalledTimes(1);
  });

  it('does not retry a path rejection when the patch carries no remove operation', async () => {
    nonZeroBalanceAr();
    mockClinicalClient.fhir.patch.mockRejectedValue(Object.assign(new Error('bad path'), { code: 422 }));

    // No stored businessStatus means no `remove` op, so there is nothing to drop and retry.
    await expect(runHandler(billingTask())).rejects.toThrow('bad path');
    expect(mockClinicalClient.fhir.patch).toHaveBeenCalledTimes(1);
  });

  it('derives the status from the stored task output, not the queued payload', async () => {
    nonZeroBalanceAr();

    // A send completed after this refresh event was queued: the payload predates its output.
    const storedTask = billingTask({
      output: [{ type: RcmTaskCodings.sendInvoiceOutputInvoiceId, valueString: 'invoice-1' }],
    });
    await runHandler(billingTask(), storedTask);

    const statusOp = patchedOperations().find((op) => op.path === '/status') as { value: string } | undefined;
    expect(statusOp?.value).toBe('completed');
  });

  it('routes candid and legacy untagged tasks through Candid, not patient AR', async () => {
    mockGetOrCreateCandidApiClient.mockResolvedValue({
      patientAr: {
        v1: {
          itemize: vi.fn(),
        },
      },
    });
    mockClinicalClient.fhir.search.mockResolvedValue({
      unbundle: () => [],
    });

    const untaggedTask = billingTask({
      meta: {},
      identifier: undefined,
    });
    const result = await runHandler(untaggedTask);

    expect(mockGetOrCreateCandidApiClient).toHaveBeenCalled();
    expect(mockZambdaExecute).not.toHaveBeenCalled();
    expect(JSON.parse(result.body).message).toContain('no Candid inventory record');
  });
});
