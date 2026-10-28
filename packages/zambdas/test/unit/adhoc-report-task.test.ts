import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import {
  ADHOC_BILLING_DATASET_TASK_CODE,
  ADHOC_REPORT_OUTPUT_URL_CODE,
  ADHOC_REPORT_PARAMS_CODE,
  ADHOC_REPORT_TASK_CODE,
  ADHOC_REPORT_TASK_SYSTEM,
} from 'utils/lib/types/adhoc/generation/report-task';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreatePresignedUrl = vi.fn();

vi.mock('../../src/shared/z3Utils', () => ({
  createPresignedUrl: (...args: unknown[]) => mockCreatePresignedUrl(...args),
}));

const { adHocReportTaskStatus, createAdHocReportTask } = await import('../../src/shared/adhoc-report');

const adHocTask = (code: string, task: Partial<Task> = {}): Task => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'requested',
  intent: 'order',
  code: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code }] },
  ...task,
});

describe('adHocReportTaskStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([ADHOC_REPORT_TASK_CODE, ADHOC_BILLING_DATASET_TASK_CODE])(
    'refuses a Task of another kind when polling for %s',
    async (expectedCode) => {
      const otherCode =
        expectedCode === ADHOC_REPORT_TASK_CODE ? ADHOC_BILLING_DATASET_TASK_CODE : ADHOC_REPORT_TASK_CODE;
      await expect(adHocReportTaskStatus(adHocTask(otherCode), expectedCode, 'token')).rejects.toMatchObject({
        message: 'Task/task-1 is not an ad-hoc report',
      });
    }
  );

  it('refuses a Task with the right code in another system', async () => {
    const task: Task = {
      ...adHocTask(ADHOC_REPORT_TASK_CODE),
      code: { coding: [{ system: 'other', code: 'adhoc-report' }] },
    };

    await expect(adHocReportTaskStatus(task, ADHOC_REPORT_TASK_CODE, 'token')).rejects.toBeDefined();
    expect(mockCreatePresignedUrl).not.toHaveBeenCalled();
  });

  it('mints a download link for a completed Task of the expected kind', async () => {
    mockCreatePresignedUrl.mockResolvedValue('https://signed.example/rows.json');
    const task = adHocTask(ADHOC_BILLING_DATASET_TASK_CODE, {
      status: 'completed',
      output: [
        {
          type: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_REPORT_OUTPUT_URL_CODE }] },
          valueString: 'https://project.api/z3/bucket/rows.json',
        },
      ],
    });

    await expect(adHocReportTaskStatus(task, ADHOC_BILLING_DATASET_TASK_CODE, 'token')).resolves.toEqual({
      status: 'completed',
      downloadUrl: 'https://signed.example/rows.json',
    });

    expect(mockCreatePresignedUrl).toHaveBeenCalledWith('token', 'https://project.api/z3/bucket/rows.json', 'download');
  });

  it('reports a failed Task with its reason', async () => {
    const task = adHocTask(ADHOC_REPORT_TASK_CODE, { status: 'failed', statusReason: { text: 'boom' } });
    await expect(adHocReportTaskStatus(task, ADHOC_REPORT_TASK_CODE, 'token')).resolves.toEqual({
      status: 'failed',
      error: 'boom',
    });
  });

  it('reports a running Task as in progress', async () => {
    const task = adHocTask(ADHOC_REPORT_TASK_CODE, { status: 'in-progress' });
    await expect(adHocReportTaskStatus(task, ADHOC_REPORT_TASK_CODE, 'token')).resolves.toEqual({
      status: 'in-progress',
    });
  });
});

describe('createAdHocReportTask', () => {
  it('creates a requested Task with the given code and the params as one JSON input', async () => {
    const create = vi.fn(async (task: Task) => ({ ...task, id: 'task-9' }));
    const oystehr = { fhir: { create } } as unknown as Oystehr;
    const dateRange = { start: '2026-10-01T00:00:00.000-04:00', end: '2026-10-19T23:59:59.999-04:00' };

    const task = await createAdHocReportTask(oystehr, ADHOC_BILLING_DATASET_TASK_CODE, {
      datasetId: 'billing-claims',
      dateRange,
    });

    expect(task.id).toBe('task-9');
    const created = create.mock.calls[0][0];
    expect(created).toMatchObject({
      resourceType: 'Task',
      status: 'requested',
      intent: 'order',
      code: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_BILLING_DATASET_TASK_CODE }] },
    });
    const params = created.input?.find((i) => i.type.coding?.some((c) => c.code === ADHOC_REPORT_PARAMS_CODE));
    expect(JSON.parse(params?.valueString ?? '')).toEqual({ datasetId: 'billing-claims', dateRange, options: {} });
  });
});
