import type { APIGatewayProxyResult } from 'aws-lambda';
import { Task as FhirTask } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { EXPORT_CSV_OUTPUT_URL_CODE, EXPORT_INVOICES_CSV_TASK_SYSTEM } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

function makeInput(): ZambdaInput {
  return { headers: null, body: null, secrets: { PROJECT_ID: 'test-project' } };
}

const mockOystehrClient = {
  fhir: {
    search: vi.fn(),
    delete: vi.fn(),
  },
  z3: {
    deleteObject: vi.fn(),
  },
};

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createOystehrClient: vi.fn(() => mockOystehrClient),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

let handler!: ZambdaHandler;

const BUCKET_NAME = 'test-project-invoiceable-patients-reports';
const Z3_BASE_URL = `https://api.example.com/z3/${BUCKET_NAME}`;

function makeCompletedTask(id: string, lastUpdated: string, objectPath?: string): FhirTask {
  const task: FhirTask = {
    resourceType: 'Task',
    id,
    status: 'completed',
    intent: 'order',
    meta: { lastUpdated },
  } as FhirTask;

  if (objectPath) {
    task.output = [
      {
        type: {
          coding: [{ system: EXPORT_INVOICES_CSV_TASK_SYSTEM, code: EXPORT_CSV_OUTPUT_URL_CODE }],
        },
        valueString: `${Z3_BASE_URL}/${objectPath}`,
      },
    ];
  }

  return task;
}

describe('cleanup-invoice-exports', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ index: handler } = (await import('../../src/cron/cleanup-invoice-exports/index')) as {
      index: ZambdaHandler;
    });
  });

  it('deletes Z3 files and Tasks older than 10 minutes', async () => {
    const oldTimestamp = DateTime.now().minus({ minutes: 15 }).toISO()!;
    const oldTask = makeCompletedTask('task-old', oldTimestamp, '2025-01-15-export.csv');

    mockOystehrClient.fhir.search.mockResolvedValue({
      unbundle: () => [oldTask],
    });
    mockOystehrClient.z3.deleteObject.mockResolvedValue(undefined);
    mockOystehrClient.fhir.delete.mockResolvedValue(undefined);

    const result = await handler(makeInput());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.deletedFiles).toBe(1);

    expect(mockOystehrClient.z3.deleteObject).toHaveBeenCalledWith({
      bucketName: BUCKET_NAME,
      'objectPath+': '2025-01-15-export.csv',
    });
    expect(mockOystehrClient.fhir.delete).not.toHaveBeenCalled();
  });

  it('skips tasks newer than 10 minutes', async () => {
    const recentTimestamp = DateTime.now().minus({ minutes: 5 }).toISO()!;
    const recentTask = makeCompletedTask('task-recent', recentTimestamp, 'recent-export.csv');

    mockOystehrClient.fhir.search.mockResolvedValue({
      unbundle: () => [recentTask],
    });

    const result = await handler(makeInput());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.deletedFiles).toBe(0);
    expect(mockOystehrClient.z3.deleteObject).not.toHaveBeenCalled();
    expect(mockOystehrClient.fhir.delete).not.toHaveBeenCalled();
  });

  it('does not delete Task when it has no output URL (failed task)', async () => {
    const oldTimestamp = DateTime.now().minus({ minutes: 20 }).toISO()!;
    const failedTask = makeCompletedTask('task-failed', oldTimestamp); // no objectPath

    mockOystehrClient.fhir.search.mockResolvedValue({
      unbundle: () => [failedTask],
    });
    mockOystehrClient.fhir.delete.mockResolvedValue(undefined);

    const result = await handler(makeInput());

    const body = JSON.parse(result.body);
    expect(body.deletedFiles).toBe(0);
    expect(mockOystehrClient.z3.deleteObject).not.toHaveBeenCalled();
    expect(mockOystehrClient.fhir.delete).not.toHaveBeenCalled();
  });

  it('continues processing when Z3 delete fails', async () => {
    const oldTimestamp = DateTime.now().minus({ minutes: 30 }).toISO()!;
    const task1 = makeCompletedTask('task-1', oldTimestamp, 'file1.csv');
    const task2 = makeCompletedTask('task-2', oldTimestamp, 'file2.csv');

    mockOystehrClient.fhir.search.mockResolvedValue({
      unbundle: () => [task1, task2],
    });
    mockOystehrClient.z3.deleteObject.mockRejectedValueOnce(new Error('Z3 error')).mockResolvedValueOnce(undefined);
    mockOystehrClient.fhir.delete.mockResolvedValue(undefined);

    const result = await handler(makeInput());

    const body = JSON.parse(result.body);
    // First Z3 delete failed, second succeeded
    expect(body.deletedFiles).toBe(1);
    expect(mockOystehrClient.fhir.delete).not.toHaveBeenCalled();
  });

  it('continues processing when Z3 delete fails for one task', async () => {
    const oldTimestamp = DateTime.now().minus({ minutes: 30 }).toISO()!;
    const task1 = makeCompletedTask('task-1', oldTimestamp, 'file1.csv');
    const task2 = makeCompletedTask('task-2', oldTimestamp, 'file2.csv');

    mockOystehrClient.fhir.search.mockResolvedValue({
      unbundle: () => [task1, task2],
    });
    mockOystehrClient.z3.deleteObject.mockResolvedValue(undefined);

    const result = await handler(makeInput());

    const body = JSON.parse(result.body);
    expect(body.deletedFiles).toBe(2);
    expect(mockOystehrClient.fhir.delete).not.toHaveBeenCalled();
  });

  it('handles empty search results', async () => {
    mockOystehrClient.fhir.search.mockResolvedValue({
      unbundle: () => [],
    });

    const result = await handler(makeInput());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.deletedFiles).toBe(0);
  });

  it('handles mix of old and recent tasks', async () => {
    const oldTimestamp = DateTime.now().minus({ minutes: 60 }).toISO()!;
    const recentTimestamp = DateTime.now().minus({ minutes: 3 }).toISO()!;
    const oldTask = makeCompletedTask('task-old', oldTimestamp, 'old-export.csv');
    const recentTask = makeCompletedTask('task-recent', recentTimestamp, 'recent-export.csv');

    mockOystehrClient.fhir.search.mockResolvedValue({
      unbundle: () => [oldTask, recentTask],
    });
    mockOystehrClient.z3.deleteObject.mockResolvedValue(undefined);
    mockOystehrClient.fhir.delete.mockResolvedValue(undefined);

    const result = await handler(makeInput());

    const body = JSON.parse(result.body);
    expect(body.deletedFiles).toBe(1);
    // Only the old task's file should be cleaned up
    expect(mockOystehrClient.z3.deleteObject).toHaveBeenCalledTimes(1);
    expect(mockOystehrClient.fhir.delete).not.toHaveBeenCalled();
  });
});
