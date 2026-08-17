import type { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  EXPORT_CSV_OUTPUT_URL_CODE,
  EXPORT_FILE_CLEANED_TAG,
  EXPORT_TASK_SYSTEM,
} from 'utils/lib/types/api/invoicing.types';
import { EXPORT_CLAIMS_CSV_TASK_CODE } from 'utils/lib/types/data/billing/billing.constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../../src/shared/types/common';

const BUCKET_NAME = 'test-project-billing-claim-exports';

function makeInput(): ZambdaInput {
  return {
    headers: null,
    body: null,
    secrets: {
      PROJECT_ID: 'test-project',
    },
  };
}

const mockOystehrClient = {
  fhir: {
    search: vi.fn(),
    patch: vi.fn(),
  },
  z3: {
    deleteObject: vi.fn(),
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

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

let handler!: ZambdaHandler;

const minutesAgo = (minutes: number): string => DateTime.now().minus({ minutes }).toISO() as string;

const finishedTask = (id: string, lastUpdated: string, objectPath?: string): Task =>
  ({
    resourceType: 'Task',
    id,
    status: 'completed',
    intent: 'order',
    meta: {
      lastUpdated,
    },
    output: objectPath
      ? [
          {
            type: {
              coding: [
                {
                  system: EXPORT_TASK_SYSTEM,
                  code: EXPORT_CSV_OUTPUT_URL_CODE,
                },
              ],
            },
            valueString: `https://api.example.com/z3/${BUCKET_NAME}/${objectPath}`,
          },
        ]
      : undefined,
  }) as Task;

const stubTasks = (tasks: Task[]): void => {
  mockOystehrClient.fhir.search.mockResolvedValue({
    unbundle: () => tasks,
  });
};

const stubTaskPages = (pages: Task[][]): void => {
  const total = pages.flat().length;
  const queue = [...pages];
  mockOystehrClient.fhir.search.mockImplementation(async () => {
    const page = queue.shift() ?? [];
    return {
      total,
      entry: page.map((task) => ({
        resource: task,
        search: {
          mode: 'match',
        },
      })),
      unbundle: () => page,
    };
  });
};

const cleanedTagOperation = {
  op: 'add',
  path: '/meta/tag',
  value: [EXPORT_FILE_CLEANED_TAG],
};

const searchParams = (): { name: string; value: string }[] => mockOystehrClient.fhir.search.mock.calls[0][0].params;

const paramValue = (name: string): string | undefined => searchParams().find((param) => param.name === name)?.value;

describe('cleanup-billing-claim-exports', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockOystehrClient.z3.deleteObject.mockResolvedValue(undefined);
    mockOystehrClient.fhir.patch.mockResolvedValue({});
    ({ index: handler } = (await import('../../../src/cron/cleanup-billing-claim-exports/index')) as {
      index: ZambdaHandler;
    });
  });

  it('searches only finished claim export tasks that have not been cleaned yet', async () => {
    stubTasks([]);

    await handler(makeInput());

    expect(paramValue('code')).toBe(`${EXPORT_TASK_SYSTEM}|${EXPORT_CLAIMS_CSV_TASK_CODE}`);
    expect(paramValue('status')).toBe('completed,failed');
    expect(paramValue('_tag:not')).toBe(`${EXPORT_FILE_CLEANED_TAG.system}|${EXPORT_FILE_CLEANED_TAG.code}`);
  });

  it('deletes the CSV of an export that has had time to be downloaded', async () => {
    stubTasks([finishedTask('task-1', minutesAgo(30), 'billing-claims-export-task-1.csv')]);

    const result = await handler(makeInput());

    expect(mockOystehrClient.z3.deleteObject).toHaveBeenCalledWith({
      bucketName: BUCKET_NAME,
      'objectPath+': 'billing-claims-export-task-1.csv',
    });
    expect(JSON.parse(result.body).deletedFiles).toBe(1);
  });

  it('drops the download url from the task it cleaned and marks it cleaned', async () => {
    stubTasks([finishedTask('task-1', minutesAgo(30), 'billing-claims-export-task-1.csv')]);

    await handler(makeInput());

    expect(mockOystehrClient.fhir.patch).toHaveBeenCalledWith({
      resourceType: 'Task',
      id: 'task-1',
      operations: [
        {
          op: 'remove',
          path: '/output/0',
        },
        cleanedTagOperation,
      ],
    });
  });

  it('ignores a cleaned task the search returned in spite of the filter', async () => {
    const cleaned = finishedTask('task-1', minutesAgo(30), 'billing-claims-export-task-1.csv');
    stubTasks([
      {
        ...cleaned,
        meta: {
          ...cleaned.meta,
          tag: [EXPORT_FILE_CLEANED_TAG],
        },
      },
    ]);

    const result = await handler(makeInput());

    expect(mockOystehrClient.z3.deleteObject).not.toHaveBeenCalled();
    expect(mockOystehrClient.fhir.patch).not.toHaveBeenCalled();
    expect(JSON.parse(result.body).deletedFiles).toBe(0);
  });

  it('reaches exports past the first page of results', async () => {
    stubTaskPages([
      [finishedTask('task-1', minutesAgo(30), 'billing-claims-export-task-1.csv')],
      [finishedTask('task-2', minutesAgo(30), 'billing-claims-export-task-2.csv')],
    ]);

    const result = await handler(makeInput());

    expect(mockOystehrClient.z3.deleteObject).toHaveBeenCalledTimes(2);
    expect(JSON.parse(result.body).deletedFiles).toBe(2);
  });

  it('leaves a just-finished export alone', async () => {
    stubTasks([finishedTask('task-1', minutesAgo(1), 'billing-claims-export-task-1.csv')]);

    const result = await handler(makeInput());

    expect(mockOystehrClient.z3.deleteObject).not.toHaveBeenCalled();
    expect(JSON.parse(result.body).deletedFiles).toBe(0);
  });

  it('marks a failed export that never produced a CSV cleaned so it stops being scanned', async () => {
    stubTasks([finishedTask('task-1', minutesAgo(30))]);

    await handler(makeInput());

    expect(mockOystehrClient.z3.deleteObject).not.toHaveBeenCalled();
    expect(mockOystehrClient.fhir.patch).toHaveBeenCalledWith({
      resourceType: 'Task',
      id: 'task-1',
      operations: [cleanedTagOperation],
    });
  });

  it('leaves an export task that came back without an id untouched', async () => {
    stubTasks([
      {
        ...finishedTask('task-1', minutesAgo(30), 'billing-claims-export-task-1.csv'),
        id: undefined,
      },
    ]);

    const result = await handler(makeInput());

    expect(mockOystehrClient.z3.deleteObject).not.toHaveBeenCalled();
    expect(mockOystehrClient.fhir.patch).not.toHaveBeenCalled();
    expect(JSON.parse(result.body).deletedFiles).toBe(0);
  });

  it('leaves an export untagged when its object could not be deleted, so the next run retries it', async () => {
    stubTasks([
      finishedTask('task-1', minutesAgo(30), 'billing-claims-export-task-1.csv'),
      finishedTask('task-2', minutesAgo(30), 'billing-claims-export-task-2.csv'),
    ]);
    mockOystehrClient.z3.deleteObject.mockRejectedValueOnce(new Error('gone'));

    const result = await handler(makeInput());

    expect(mockOystehrClient.z3.deleteObject).toHaveBeenCalledTimes(2);
    expect(JSON.parse(result.body).deletedFiles).toBe(1);
    expect(mockOystehrClient.fhir.patch).toHaveBeenCalledTimes(1);
    expect(mockOystehrClient.fhir.patch.mock.calls[0][0].id).toBe('task-2');
  });
});
