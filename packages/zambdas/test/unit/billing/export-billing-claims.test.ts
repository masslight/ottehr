import type { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { EXPORT_CSV_OUTPUT_URL_CODE, EXPORT_TASK_SYSTEM } from 'utils/lib/types/api/invoicing.types';
import {
  EXPORT_CLAIMS_CSV_TASK_CODE,
  EXPORT_CLAIMS_FILTERS_CODE,
  EXPORT_CLAIMS_INCOMPLETE_CODE,
} from 'utils/lib/types/data/billing/billing.constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../../src/shared/types/common';

function makeInput(body: Record<string, unknown>): ZambdaInput {
  return {
    headers: null,
    body: JSON.stringify(body),
    secrets: {
      PROJECT_ID: 'test-project',
    },
  };
}

const mockOystehrClient = {
  fhir: {
    create: vi.fn(),
    get: vi.fn(),
  },
};

vi.mock('../../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('../../../src/billing/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createBillingClient: vi.fn(() => mockOystehrClient),
  };
});

const mockCreatePresignedUrl = vi.fn();
vi.mock('../../../src/shared/z3Utils', () => ({
  createPresignedUrl: (...args: unknown[]) => mockCreatePresignedUrl(...args),
}));

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

let handler!: ZambdaHandler;

const taskFilters = (task: Task): unknown =>
  JSON.parse(
    task.input?.find((input) => input.type?.coding?.some((coding) => coding.code === EXPORT_CLAIMS_FILTERS_CODE))
      ?.valueString ?? 'null'
  );

const exportTaskCode: Task['code'] = {
  coding: [
    {
      system: EXPORT_TASK_SYSTEM,
      code: EXPORT_CLAIMS_CSV_TASK_CODE,
    },
  ],
};

const exportTask = (task: Partial<Task>): Task =>
  ({
    resourceType: 'Task',
    id: 'task-1',
    code: exportTaskCode,
    ...task,
  }) as Task;

const completedTask = (output: Task['output']): Task =>
  exportTask({
    status: 'completed',
    output,
  });

describe('export-billing-claims', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ index: handler } = (await import('../../../src/billing/export-billing-claims/index')) as {
      index: ZambdaHandler;
    });
  });

  describe('kick-off mode', () => {
    beforeEach(() => {
      mockOystehrClient.fhir.create.mockResolvedValue({ resourceType: 'Task', id: 'task-123' } as Task);
    });

    it('creates a requested export Task and returns its id', async () => {
      const result = await handler(makeInput({}));

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ taskId: 'task-123' });
      expect(mockOystehrClient.fhir.create).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'Task',
          status: 'requested',
          intent: 'order',
          code: {
            coding: [
              {
                system: EXPORT_TASK_SYSTEM,
                code: EXPORT_CLAIMS_CSV_TASK_CODE,
              },
            ],
          },
        })
      );
    });

    it('fails rather than handing back an id the caller cannot poll', async () => {
      mockOystehrClient.fhir.create.mockResolvedValue({ resourceType: 'Task' } as Task);

      await expect(handler(makeInput({}))).rejects.toThrow('Export Task was created without an id');
    });

    it('carries the whole filter set to the worker', async () => {
      await handler(
        makeInput({
          searchText: 'Smith',
          arStage: 'patient-ar',
          status: 'denied',
          payerId: 'P1',
          serviceDateFrom: '2026-01-01',
          serviceDateTo: '2026-01-31',
        })
      );

      const task = mockOystehrClient.fhir.create.mock.calls[0][0] as Task;
      expect(taskFilters(task)).toEqual({
        searchText: 'Smith',
        arStage: 'patient-ar',
        status: 'denied',
        payerId: 'P1',
        serviceDateFrom: '2026-01-01',
        serviceDateTo: '2026-01-31',
      });
    });

    it('never leaks secrets into the Task', async () => {
      await handler(makeInput({ status: 'denied' }));

      const task = mockOystehrClient.fhir.create.mock.calls[0][0] as Task;
      expect(taskFilters(task)).toEqual({ status: 'denied' });
    });

    it('rejects a filter the claims list would not accept', async () => {
      await expect(handler(makeInput({ type: 'not-a-claim-type' }))).rejects.toBeDefined();
      expect(mockOystehrClient.fhir.create).not.toHaveBeenCalled();
    });
  });

  describe('status mode', () => {
    it('mints a download link once the export has completed', async () => {
      mockOystehrClient.fhir.get.mockResolvedValue(
        completedTask([
          {
            type: {
              coding: [
                {
                  system: EXPORT_TASK_SYSTEM,
                  code: EXPORT_CSV_OUTPUT_URL_CODE,
                },
              ],
            },
            valueString: 'https://project.api/z3/bucket/claims.csv',
          },
        ])
      );
      mockCreatePresignedUrl.mockResolvedValue('https://signed.example/claims.csv');

      const result = await handler(makeInput({ taskId: 'task-1' }));

      expect(mockOystehrClient.fhir.get).toHaveBeenCalledWith({
        resourceType: 'Task',
        id: 'task-1',
      });
      expect(mockCreatePresignedUrl).toHaveBeenCalledWith(
        'mock-token',
        'https://project.api/z3/bucket/claims.csv',
        'download'
      );
      expect(JSON.parse(result.body)).toEqual({
        status: 'completed',
        downloadUrl: 'https://signed.example/claims.csv',
        incomplete: false,
      });
      expect(mockOystehrClient.fhir.create).not.toHaveBeenCalled();
    });

    it('reports an export that could not see every match', async () => {
      mockOystehrClient.fhir.get.mockResolvedValue(
        completedTask([
          {
            type: {
              coding: [
                {
                  system: EXPORT_TASK_SYSTEM,
                  code: EXPORT_CSV_OUTPUT_URL_CODE,
                },
              ],
            },
            valueString: 'https://project.api/z3/bucket/claims.csv',
          },
          {
            type: {
              coding: [
                {
                  system: EXPORT_TASK_SYSTEM,
                  code: EXPORT_CLAIMS_INCOMPLETE_CODE,
                },
              ],
            },
            valueString: 'true',
          },
        ])
      );
      mockCreatePresignedUrl.mockResolvedValue('https://signed.example/claims.csv');

      const result = await handler(makeInput({ taskId: 'task-1' }));

      expect(JSON.parse(result.body).incomplete).toBe(true);
    });

    it('reports work still in flight without a link', async () => {
      mockOystehrClient.fhir.get.mockResolvedValue(exportTask({ status: 'in-progress' }));

      const result = await handler(makeInput({ taskId: 'task-1' }));

      expect(JSON.parse(result.body)).toEqual({ status: 'in-progress' });
      expect(mockCreatePresignedUrl).not.toHaveBeenCalled();
    });

    it('refuses a task that is not a claims export', async () => {
      mockOystehrClient.fhir.get.mockResolvedValue({
        resourceType: 'Task',
        id: 'task-1',
        status: 'completed',
        code: {
          coding: [
            {
              system: EXPORT_TASK_SYSTEM,
              code: 'export-invoices-csv',
            },
          ],
        },
        output: [
          {
            type: {
              coding: [
                {
                  system: EXPORT_TASK_SYSTEM,
                  code: EXPORT_CSV_OUTPUT_URL_CODE,
                },
              ],
            },
            valueString: 'https://project.api/z3/bucket/invoices.csv',
          },
        ],
      } as Task);

      await expect(handler(makeInput({ taskId: 'task-1' }))).rejects.toBeDefined();
      expect(mockCreatePresignedUrl).not.toHaveBeenCalled();
    });

    it('surfaces why the export failed, as it was written', async () => {
      mockOystehrClient.fhir.get.mockResolvedValue(
        exportTask({
          status: 'failed',
          statusReason: {
            coding: [
              {
                code: 'payer-lookup-timed-out',
              },
            ],
            text: 'payer lookup timed out',
          },
        })
      );

      const result = await handler(makeInput({ taskId: 'task-1' }));

      expect(JSON.parse(result.body)).toEqual({
        status: 'failed',
        error: 'payer lookup timed out',
      });
    });

    it('falls back to the reason code when the failure carries no text', async () => {
      mockOystehrClient.fhir.get.mockResolvedValue(
        exportTask({
          status: 'failed',
          statusReason: {
            coding: [
              {
                code: 'payer-lookup-timed-out',
              },
            ],
          },
        })
      );

      expect(JSON.parse((await handler(makeInput({ taskId: 'task-1' }))).body).error).toBe('payer-lookup-timed-out');
    });

    it('falls back to a generic error when the failure carries no reason', async () => {
      mockOystehrClient.fhir.get.mockResolvedValue(exportTask({ status: 'failed' }));

      expect(JSON.parse((await handler(makeInput({ taskId: 'task-1' }))).body).error).toBe('Export failed');
    });

    it('does not claim completion when the CSV url is missing', async () => {
      mockOystehrClient.fhir.get.mockResolvedValue(completedTask(undefined));

      const result = await handler(makeInput({ taskId: 'task-1' }));

      expect(JSON.parse(result.body)).toEqual({ status: 'completed' });
      expect(mockCreatePresignedUrl).not.toHaveBeenCalled();
    });
  });
});
