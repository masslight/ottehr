import type { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import {
  ADHOC_BILLING_DATASET_TASK_CODE,
  ADHOC_REPORT_TASK_CODE,
  ADHOC_REPORT_TASK_SYSTEM,
} from 'utils/lib/types/adhoc/generation/report-task';
import { AD_HOC_REPORT_VIEW_ROLES } from 'utils/lib/types/api/adhoc-report-access';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateRequestParameters } from '../../../src/billing/adhoc-billing-dataset/validateRequestParameters';
import type { ZambdaInput } from '../../../src/shared/types/common';

const DATE_RANGE = { start: '2026-10-01T00:00:00.000-04:00', end: '2026-10-19T23:59:59.999-04:00' };

const makeInput = (body: Record<string, unknown>): ZambdaInput => ({
  headers: { Authorization: 'Bearer user-token' },
  body: JSON.stringify(body),
  secrets: { PROJECT_ID: 'test-project' },
});

describe('adhoc-billing-dataset validateRequestParameters', () => {
  it('reads a start request', () => {
    expect(
      validateRequestParameters(
        makeInput({ datasetId: 'billing-claims', dateRange: DATE_RANGE, options: { remits: true } })
      )
    ).toMatchObject({ datasetId: 'billing-claims', dateRange: DATE_RANGE, options: { remits: true } });
  });

  it('reads a poll request', () => {
    expect(validateRequestParameters(makeInput({ taskId: 'task-1' }))).toMatchObject({ taskId: 'task-1' });
  });

  it('rejects a dataset the billing app does not serve', () => {
    expect(() => validateRequestParameters(makeInput({ datasetId: 'billing', dateRange: DATE_RANGE }))).toThrow(
      expect.objectContaining({ message: expect.stringContaining('Unknown billing dataset "billing"') })
    );
  });

  it('rejects a start request without a date range', () => {
    expect(() => validateRequestParameters(makeInput({ datasetId: 'billing-claims' }))).toThrow();
  });
});

const mockOystehrClient = { fhir: { create: vi.fn(), get: vi.fn() } };
const mockRequireUserWithRole = vi.fn();

vi.mock('../../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  requireUserWithRole: (...args: unknown[]) => mockRequireUserWithRole(...args),
}));

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

const mockCreateBillingClient = vi.fn(() => mockOystehrClient);
vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createBillingClient: () => mockCreateBillingClient(),
}));

vi.mock('../../../src/shared/z3Utils', () => ({
  createPresignedUrl: vi.fn().mockResolvedValue('https://signed.example/rows.json'),
}));

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

describe('adhoc-billing-dataset handler', () => {
  let handler!: ZambdaHandler;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequireUserWithRole.mockResolvedValue(undefined);
    ({ index: handler } = (await import('../../../src/billing/adhoc-billing-dataset/index')) as {
      index: ZambdaHandler;
    });
  });

  it('starts a billing dataset Task as the billing app, for an ad-hoc report user only', async () => {
    mockOystehrClient.fhir.create.mockImplementation(async (task: Task) => ({ ...task, id: 'task-1' }));

    const result = await handler(makeInput({ datasetId: 'billing-claims', dateRange: DATE_RANGE }));

    expect(JSON.parse(result.body)).toEqual({ taskId: 'task-1' });
    expect(mockRequireUserWithRole).toHaveBeenCalledWith('user-token', expect.anything(), AD_HOC_REPORT_VIEW_ROLES);
    expect(mockCreateBillingClient).toHaveBeenCalled();
    expect(mockOystehrClient.fhir.create.mock.calls[0][0].code).toEqual({
      coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_BILLING_DATASET_TASK_CODE }],
    });
  });

  it('stops a user without the ad-hoc report role before any Task exists', async () => {
    mockRequireUserWithRole.mockRejectedValue(new Error('forbidden'));

    await expect(handler(makeInput({ datasetId: 'billing-claims', dateRange: DATE_RANGE }))).rejects.toThrow(
      'forbidden'
    );
    expect(mockOystehrClient.fhir.create).not.toHaveBeenCalled();
  });

  it('will not answer a poll for a clinical ad-hoc Task', async () => {
    mockOystehrClient.fhir.get.mockResolvedValue({
      resourceType: 'Task',
      id: 'task-9',
      status: 'completed',
      intent: 'order',
      code: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_REPORT_TASK_CODE }] },
    } as Task);

    await expect(handler(makeInput({ taskId: 'task-9' }))).rejects.toMatchObject({
      message: 'Task/task-9 is not an ad-hoc report',
    });
  });
});
