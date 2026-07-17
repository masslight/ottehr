import type { APIGatewayProxyResult } from 'aws-lambda';
import type { Operation } from 'fast-json-patch';
import { Task, TaskInput } from 'fhir/r4b';
import {
  INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
  invoiceTaskSourceTag,
  RcmTaskCodings,
  ZERO_BALANCE_BUSINESS_STATUS_CODE,
} from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

const mockClinicalClient = {
  fhir: {
    search: vi.fn(),
    patch: vi.fn(),
  },
};
const mockBillingClient = { billing: true };
const mockEraReadClient = { eraRead: true };
const mockSearchPatientArClaims = vi.fn();
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

vi.mock('../../src/billing/shared', () => ({
  createBillingClient: () => mockBillingClient,
  createEraReadClient: () => mockEraReadClient,
}));

vi.mock('../../src/billing/search-billing-patient-ar-claims/handler', () => ({
  searchPatientArClaims: (...args: unknown[]) => mockSearchPatientArClaims(...args),
}));

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

const runHandler = (task: Task): Promise<APIGatewayProxyResult> =>
  handler({
    headers: null,
    body: JSON.stringify(task),
    secrets: {
      PROJECT_ID: 'test-project',
    },
  });

const patchedOperations = (): Operation[] => mockClinicalClient.fhir.patch.mock.calls[0][0].operations as Operation[];

const patchedInputEntry = (code: string): TaskInput | undefined => {
  const inputOp = patchedOperations().find((op) => op.path === '/input') as { value: TaskInput[] } | undefined;
  return inputOp?.value.find((entry) => entry.type.coding?.some((coding) => coding.code === code));
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
    mockSearchPatientArClaims.mockResolvedValue({
      claims: [arItem()],
      total: 1,
      offset: 0,
      pageSize: 25,
    });

    const result = await runHandler(billingTask());

    expect(JSON.parse(result.body).message).toContain('successfully updated');
    expect(mockGetOrCreateCandidApiClient).not.toHaveBeenCalled();
    expect(mockSearchPatientArClaims).toHaveBeenCalledWith(
      expect.objectContaining({
        billingClient: mockBillingClient,
        eraReadClient: mockEraReadClient,
        claimIds: ['claim-1'],
        includeZeroBalance: true,
      })
    );

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
    mockSearchPatientArClaims.mockResolvedValue({
      claims: [
        arItem({
          balance: 0,
        }),
      ],
      total: 1,
      offset: 0,
      pageSize: 25,
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
    mockSearchPatientArClaims.mockResolvedValue({
      claims: [],
      total: 0,
      offset: 0,
      pageSize: 25,
    });

    const result = await runHandler(billingTask());

    expect(JSON.parse(result.body).message).toContain('no billing record');
    expect(patchedOperations()).toEqual([
      {
        op: 'replace',
        path: '/status',
        value: 'failed',
      },
    ]);
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
    expect(mockSearchPatientArClaims).not.toHaveBeenCalled();
    expect(JSON.parse(result.body).message).toContain('no billing record');
  });
});
