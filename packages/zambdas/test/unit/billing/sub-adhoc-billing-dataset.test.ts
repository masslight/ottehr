import { Task } from 'fhir/r4b';
import {
  ADHOC_BILLING_DATASET_TASK_CODE,
  ADHOC_REPORT_PARAMS_CODE,
  ADHOC_REPORT_TASK_SYSTEM,
} from 'utils/lib/types/adhoc/generation/report-task';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type TaskHandler = (
  input: { task: Task; secrets: Record<string, string> },
  oystehr: unknown
) => Promise<{ taskStatus: string; statusReason?: string }>;

let capturedHandler!: TaskHandler;

vi.mock('../../../src/subscriptions/task/helpers', () => ({
  wrapTaskHandler: (_name: string, fn: TaskHandler) => {
    capturedHandler = fn;
    return fn;
  },
}));

vi.mock('../../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createEraReadClient: vi.fn(() => ({})),
}));

vi.mock('../../../src/billing/adhoc/rules', () => ({
  fetchAdHocRuleRows: vi.fn().mockResolvedValue([]),
}));

const oystehr = {
  fhir: { patch: vi.fn() },
  z3: { uploadFile: vi.fn(), deleteObject: vi.fn() },
};

const task: Task = {
  resourceType: 'Task',
  id: 'task-1',
  status: 'requested',
  intent: 'order',
  code: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_BILLING_DATASET_TASK_CODE }] },
  input: [
    {
      type: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_REPORT_PARAMS_CODE }] },
      valueString: JSON.stringify({
        datasetId: 'billing-rules',
        dateRange: { start: '2026-10-01T00:00:00.000-04:00', end: '2026-10-19T23:59:59.999-04:00' },
        options: {},
      }),
    },
  ],
};

const secrets = { PROJECT_ID: 'proj', PROJECT_API: 'https://project.api' };

describe('sub-adhoc-billing-dataset', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await import('../../../src/subscriptions/task/sub-adhoc-billing-dataset/index');
  });

  it('records the uploaded file on the Task', async () => {
    oystehr.fhir.patch.mockResolvedValue({});

    await expect(capturedHandler({ task, secrets }, oystehr)).resolves.toMatchObject({ taskStatus: 'completed' });

    expect(oystehr.fhir.patch.mock.calls[0][0].operations[0].value[0].valueString).toBe(
      'https://project.api/z3/proj-billing-claim-exports/adhoc-billing-dataset-task-1.json'
    );
    expect(oystehr.z3.deleteObject).not.toHaveBeenCalled();
  });

  it('deletes the uploaded file when its url cannot be recorded on the Task, so cleanup is not left without it', async () => {
    oystehr.fhir.patch.mockRejectedValue(new Error('patch failed'));

    await expect(capturedHandler({ task, secrets }, oystehr)).rejects.toThrow('patch failed');

    expect(oystehr.z3.deleteObject).toHaveBeenCalledWith({
      bucketName: 'proj-billing-claim-exports',
      'objectPath+': 'adhoc-billing-dataset-task-1.json',
    });
  });
});
