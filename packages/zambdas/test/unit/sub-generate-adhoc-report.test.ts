import { Task } from 'fhir/r4b';
import { AD_HOC_REPORT_DEFAULT_MODEL } from 'utils/lib/types/adhoc/generation/generate.types';
import {
  ADHOC_GENERATE_OUTPUT_CODE,
  ADHOC_GENERATE_PARAMS_CODE,
  ADHOC_GENERATE_TASK_CODE,
  ADHOC_REPORT_TASK_SYSTEM,
} from 'utils/lib/types/adhoc/generation/report-task';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (
  input: { task: Task; secrets: Record<string, string> },
  oystehr: unknown
) => Promise<{ taskStatus: Task['status']; statusReason?: string }>;

const { mockGenerate, mockSendErrors } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockSendErrors: vi.fn(),
}));

// Run the inner handler directly: wrapTaskHandler only adds the Task status bookkeeping around it.
vi.mock('../../src/subscriptions/task/helpers', () => ({
  wrapTaskHandler: (_name: string, fn: Handler) => fn,
}));
vi.mock('../../src/shared/adhoc-generate', () => ({ generateAdHocReportCode: mockGenerate }));
vi.mock('../../src/shared/errors', () => ({ sendErrors: mockSendErrors }));

import { index, UNEXPECTED_FAILURE_REASON } from '../../src/subscriptions/sub-generate-adhoc-report/index';

const handler = index as unknown as Handler;
const secrets = { ENVIRONMENT: 'test' };
const oystehr = { fhir: { patch: vi.fn() } };

const PARAMS = {
  schema: { datasetId: 'encounters-comprehensive', label: 'Encounters', description: '', rowCount: 1, fields: [] },
  request: 'count of encounters',
};

const makeTask = (params?: unknown): Task => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'in-progress',
  intent: 'order',
  code: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_GENERATE_TASK_CODE }] },
  ...(params === undefined
    ? {}
    : {
        input: [
          {
            type: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_GENERATE_PARAMS_CODE }] },
            valueString: JSON.stringify(params),
          },
        ],
      }),
});

describe('sub-generate-adhoc-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates with the model stored on the Task and records the result as Task output', async () => {
    const result = { code: 'return ReportRoot;', title: 'Encounters' };
    mockGenerate.mockResolvedValue(result);

    const outcome = await handler({ task: makeTask({ ...PARAMS, model: 'claudeOpus_5_5_low' }), secrets }, oystehr);

    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining(PARAMS), 'claudeOpus_5_5_low', secrets);
    expect(oystehr.fhir.patch).toHaveBeenCalledWith({
      resourceType: 'Task',
      id: 'task-1',
      operations: [
        {
          op: 'add',
          path: '/output',
          value: [
            {
              type: { coding: [{ system: ADHOC_REPORT_TASK_SYSTEM, code: ADHOC_GENERATE_OUTPUT_CODE }] },
              valueString: JSON.stringify(result),
            },
          ],
        },
      ],
    });
    expect(outcome.taskStatus).toBe('completed');
  });

  it('falls back to the default model when the Task has none', async () => {
    mockGenerate.mockResolvedValue({ code: 'return ReportRoot;' });

    await handler({ task: makeTask(PARAMS), secrets }, oystehr);

    expect(mockGenerate).toHaveBeenCalledWith(expect.anything(), AD_HOC_REPORT_DEFAULT_MODEL, secrets);
  });

  it('fails the Task with the readable message of an expected API error, without a Sentry alert', async () => {
    mockGenerate.mockRejectedValue(INVALID_INPUT_ERROR('Could not generate a valid report after 3 attempts'));

    const outcome = await handler({ task: makeTask(PARAMS), secrets }, oystehr);

    expect(outcome).toEqual({
      taskStatus: 'failed',
      statusReason: 'Could not generate a valid report after 3 attempts',
    });
    expect(mockSendErrors).not.toHaveBeenCalled();
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });

  it('hides an unexpected error behind a generic reason and reports it to Sentry', async () => {
    const error = new Error('400 {"type":"invalid_request_error","request_id":"req_123"}');
    mockGenerate.mockRejectedValue(error);

    const outcome = await handler({ task: makeTask(PARAMS), secrets }, oystehr);

    expect(outcome).toEqual({ taskStatus: 'failed', statusReason: UNEXPECTED_FAILURE_REASON });
    expect(mockSendErrors).toHaveBeenCalledWith(error, 'test');
  });

  it('treats a Task without params as an unexpected failure', async () => {
    const outcome = await handler({ task: makeTask(), secrets }, oystehr);

    expect(outcome).toEqual({ taskStatus: 'failed', statusReason: UNEXPECTED_FAILURE_REASON });
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockSendErrors).toHaveBeenCalled();
  });
});
