import type { APIGatewayProxyResult } from 'aws-lambda';
import { Task as FhirTask } from 'fhir/r4b';
import { EXPORT_CSV_OUTPUT_URL_CODE, EXPORT_INVOICES_CSV_TASK_CODE, EXPORT_INVOICES_CSV_TASK_SYSTEM } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

function makeInput(body: Record<string, unknown>): ZambdaInput {
  return { headers: null, body: JSON.stringify(body), secrets: { PROJECT_ID: 'test-project' } };
}

const mockOystehrClient = {
  fhir: {
    create: vi.fn(),
    get: vi.fn(),
  },
};

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

const mockCreatePresignedUrl = vi.fn();
vi.mock('../../src/shared/z3Utils', () => ({
  createPresignedUrl: (...args: unknown[]) => mockCreatePresignedUrl(...args),
}));

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

let handler!: ZambdaHandler;

describe('export-invoices', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ index: handler } = (await import('../../src/ehr/export-invoices/index')) as { index: ZambdaHandler });
  });

  describe('kick-off mode', () => {
    it('creates a Task and returns taskId', async () => {
      mockOystehrClient.fhir.create.mockResolvedValue({ resourceType: 'Task', id: 'task-123' } as FhirTask);

      const result = await handler(makeInput({}));

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ taskId: 'task-123' });
      expect(mockOystehrClient.fhir.create).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'Task',
          status: 'requested',
          intent: 'order',
          code: {
            coding: [{ system: EXPORT_INVOICES_CSV_TASK_SYSTEM, code: EXPORT_INVOICES_CSV_TASK_CODE }],
          },
        })
      );
    });

    it('passes filter inputs when status is provided', async () => {
      mockOystehrClient.fhir.create.mockResolvedValue({ resourceType: 'Task', id: 'task-456' } as FhirTask);

      await handler(makeInput({ status: 'completed' }));

      const createCall = mockOystehrClient.fhir.create.mock.calls[0][0] as FhirTask;
      expect(createCall.input).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: { coding: [{ system: EXPORT_INVOICES_CSV_TASK_SYSTEM, code: 'filter-status' }] },
            valueString: 'completed',
          }),
        ])
      );
    });

    it('passes sort and hideZeroBalance inputs', async () => {
      mockOystehrClient.fhir.create.mockResolvedValue({ resourceType: 'Task', id: 'task-789' } as FhirTask);

      await handler(
        makeInput({
          sortField: 'finalizationDate',
          sortDirection: 'desc',
          hideZeroBalance: true,
        })
      );

      const createCall = mockOystehrClient.fhir.create.mock.calls[0][0] as FhirTask;
      expect(createCall.input).toHaveLength(3);
      expect(createCall.input).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ valueString: 'finalizationDate' }),
          expect.objectContaining({ valueString: 'desc' }),
          expect.objectContaining({ valueBoolean: true }),
        ])
      );
    });

    it('passes filter-source input when source is provided', async () => {
      mockOystehrClient.fhir.create.mockResolvedValue({
        resourceType: 'Task',
        id: 'task-source',
      } as FhirTask);

      await handler(makeInput({ source: 'ottehr-billing' }));

      const createCall = mockOystehrClient.fhir.create.mock.calls[0][0] as FhirTask;
      expect(createCall.input).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: {
              coding: [
                {
                  system: EXPORT_INVOICES_CSV_TASK_SYSTEM,
                  code: 'filter-source',
                },
              ],
            },
            valueString: 'ottehr-billing',
          }),
        ])
      );
    });

    it('omits input array when no filters provided', async () => {
      mockOystehrClient.fhir.create.mockResolvedValue({ resourceType: 'Task', id: 'task-no-filters' } as FhirTask);

      await handler(makeInput({}));

      const createCall = mockOystehrClient.fhir.create.mock.calls[0][0] as FhirTask;
      expect(createCall.input).toBeUndefined();
    });
  });

  describe('status check mode', () => {
    it('returns completed with downloadUrl', async () => {
      const z3Url = 'https://api.example.com/z3/test-bucket/export.csv';
      mockOystehrClient.fhir.get.mockResolvedValue({
        resourceType: 'Task',
        status: 'completed',
        output: [
          {
            type: { coding: [{ system: EXPORT_INVOICES_CSV_TASK_SYSTEM, code: EXPORT_CSV_OUTPUT_URL_CODE }] },
            valueString: z3Url,
          },
        ],
      } as FhirTask);
      mockCreatePresignedUrl.mockResolvedValue('https://presigned-download-url.com');

      const result = await handler(makeInput({ taskId: 'task-123' }));

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('completed');
      expect(body.downloadUrl).toBe('https://presigned-download-url.com');
      expect(mockCreatePresignedUrl).toHaveBeenCalledWith('mock-token', z3Url, 'download');
    });

    it('returns in-progress status', async () => {
      mockOystehrClient.fhir.get.mockResolvedValue({
        resourceType: 'Task',
        status: 'in-progress',
      } as FhirTask);

      const result = await handler(makeInput({ taskId: 'task-123' }));

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('in-progress');
      expect(body.downloadUrl).toBeUndefined();
    });

    it('returns failed status with error reason', async () => {
      mockOystehrClient.fhir.get.mockResolvedValue({
        resourceType: 'Task',
        status: 'failed',
        statusReason: { coding: [{ code: 'timeout' }] },
      } as FhirTask);

      const result = await handler(makeInput({ taskId: 'task-123' }));

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('failed');
      expect(body.error).toBe('timeout');
    });

    it('returns default error message when failed without reason', async () => {
      mockOystehrClient.fhir.get.mockResolvedValue({
        resourceType: 'Task',
        status: 'failed',
      } as FhirTask);

      const result = await handler(makeInput({ taskId: 'task-123' }));

      const body = JSON.parse(result.body);
      expect(body.status).toBe('failed');
      expect(body.error).toBe('Export failed');
    });
  });
});
