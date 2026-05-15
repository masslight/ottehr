import type { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../../src/shared/types/common';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPatch = vi.fn();
const mockGet = vi.fn();
const mockSearch = vi.fn();

const mockOystehrClient = {
  fhir: {
    create: vi.fn(),
    get: mockGet,
    update: vi.fn(),
    patch: mockPatch,
    search: mockSearch,
    transaction: vi.fn(),
  },
};

vi.mock('../../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createOystehrClient: vi.fn(() => mockOystehrClient),
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const testSecrets = { test: 'secret' };

function makeInput(body: Record<string, unknown>): ZambdaInput {
  return { headers: null, body: JSON.stringify(body), secrets: testSecrets };
}

// ── cancel-outreach-task ──────────────────────────────────────────────────

describe('cancel-outreach-task', () => {
  let handler: ZambdaHandler;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../../src/rcm/scheduled-outreach/cancel-outreach-task/index');
    handler = mod.index as ZambdaHandler;
  });

  it('cancels a draft task', async () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-1',
      status: 'draft',
      intent: 'order',
      executionPeriod: { start: '2024-01-01T00:00:00Z' },
      meta: { tag: [{ system: 'https://fhir.zapehr.com/r4/StructureDefinitions/outreach-task', code: 'invoice-due' }] },
    };
    mockGet.mockResolvedValue(task);
    mockPatch.mockResolvedValue({});

    const result = await handler(makeInput({ taskId: 'task-1' }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ success: true, taskId: 'task-1' });
    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch.mock.calls[0][0].operations).toEqual(
      expect.arrayContaining([expect.objectContaining({ op: 'replace', path: '/status', value: 'cancelled' })])
    );
  });

  it('cancels a requested task', async () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-2',
      status: 'requested',
      intent: 'order',
      executionPeriod: { start: '2024-01-01T00:00:00Z' },
      meta: { tag: [{ system: 'https://fhir.zapehr.com/r4/StructureDefinitions/outreach-task', code: 'invoice-due' }] },
    };
    mockGet.mockResolvedValue(task);
    mockPatch.mockResolvedValue({});

    const result = await handler(makeInput({ taskId: 'task-2' }));
    expect(result.statusCode).toBe(200);
  });

  it('returns 400 for completed tasks', async () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-3',
      status: 'completed',
      intent: 'order',
    };
    mockGet.mockResolvedValue(task);

    const result = await handler(makeInput({ taskId: 'task-3' }));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('cannot be cancelled');
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('returns 400 for in-progress tasks', async () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-4',
      status: 'in-progress',
      intent: 'order',
    };
    mockGet.mockResolvedValue(task);

    const result = await handler(makeInput({ taskId: 'task-4' }));
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for failed tasks', async () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-5',
      status: 'failed',
      intent: 'order',
    };
    mockGet.mockResolvedValue(task);

    const result = await handler(makeInput({ taskId: 'task-5' }));
    expect(result.statusCode).toBe(400);
  });

  it('throws when taskId is missing', async () => {
    await expect(handler(makeInput({}))).rejects.toThrow();
  });

  it('throws when secrets are missing', async () => {
    await expect(handler({ headers: null, body: JSON.stringify({ taskId: 'x' }), secrets: null })).rejects.toThrow();
  });
});

// ── retry-outreach-task ──────────────────────────────────────────────────

describe('retry-outreach-task', () => {
  let handler: ZambdaHandler;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../../src/rcm/scheduled-outreach/retry-outreach-task/index');
    handler = mod.index as ZambdaHandler;
  });

  const outreachTag = { system: 'https://fhir.zapehr.com/r4/StructureDefinitions/outreach-task', code: 'invoice-due' };

  it('resets a failed task to requested status', async () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-1',
      status: 'failed',
      intent: 'order',
      meta: { tag: [outreachTag] },
      executionPeriod: { start: '2024-01-01T00:00:00Z', end: '2024-01-02T00:00:00Z' },
      output: [{ type: { text: 'error' }, valueString: 'Payment failed' }],
    };
    mockGet.mockResolvedValue(task);
    mockPatch.mockResolvedValue({});

    const result = await handler(makeInput({ taskId: 'task-1' }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ success: true, taskId: 'task-1' });
    expect(mockPatch).toHaveBeenCalledTimes(1);

    const ops = mockPatch.mock.calls[0][0].operations;
    expect(ops).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'replace', path: '/status', value: 'requested' }),
        expect.objectContaining({ op: 'remove', path: '/executionPeriod/end' }),
        expect.objectContaining({ op: 'remove', path: '/output' }),
      ])
    );
  });

  it('only removes executionPeriod/end and output when they exist', async () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-1b',
      status: 'failed',
      intent: 'order',
      meta: { tag: [outreachTag] },
    };
    mockGet.mockResolvedValue(task);
    mockPatch.mockResolvedValue({});

    const result = await handler(makeInput({ taskId: 'task-1b' }));

    expect(result.statusCode).toBe(200);
    const ops = mockPatch.mock.calls[0][0].operations;
    expect(ops).toEqual([{ op: 'replace', path: '/status', value: 'requested' }]);
  });

  it('returns 400 for non-outreach tasks', async () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-not-outreach',
      status: 'failed',
      intent: 'order',
    };
    mockGet.mockResolvedValue(task);

    const result = await handler(makeInput({ taskId: 'task-not-outreach' }));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('not a scheduled outreach task');
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('returns 400 for draft tasks', async () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-2',
      status: 'draft',
      intent: 'order',
      meta: { tag: [outreachTag] },
    };
    mockGet.mockResolvedValue(task);

    const result = await handler(makeInput({ taskId: 'task-2' }));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('cannot be retried');
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('returns 400 for completed tasks', async () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-3',
      status: 'completed',
      intent: 'order',
      meta: { tag: [outreachTag] },
    };
    mockGet.mockResolvedValue(task);

    const result = await handler(makeInput({ taskId: 'task-3' }));
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for requested tasks', async () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-4',
      status: 'requested',
      intent: 'order',
      meta: { tag: [outreachTag] },
    };
    mockGet.mockResolvedValue(task);

    const result = await handler(makeInput({ taskId: 'task-4' }));
    expect(result.statusCode).toBe(400);
  });

  it('throws when taskId is missing', async () => {
    await expect(handler(makeInput({}))).rejects.toThrow();
  });
});

// ── list-outreach-tasks ──────────────────────────────────────────────────

describe('list-outreach-tasks', () => {
  let handler: ZambdaHandler;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSearch.mockReset();
    const mod = await import('../../../src/rcm/scheduled-outreach/list-outreach-tasks/index');
    handler = mod.index as ZambdaHandler;
  });

  function mockBundle(resources: any[], total?: number): { unbundle: () => any[]; total: number; link: never[] } {
    return { unbundle: () => resources, total: total ?? resources.length, link: [] };
  }

  it('returns paginated task summaries', async () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-1',
      status: 'draft',
      intent: 'order',
      for: { reference: 'Patient/pat-1' },
      focus: { reference: 'Encounter/enc-1' },
      executionPeriod: { start: '2025-02-01T10:00:00Z' },
      authoredOn: '2025-01-15T10:00:00Z',
      description: 'Outreach: Send Notification triggered by invoice-due',
      code: { coding: [{ system: 'https://ottehr.com/CodeSystem/outreach-action-type', code: 'send-notification' }] },
      meta: { tag: [{ system: 'https://fhir.ottehr.com/r4/outreach-task', code: 'invoice-due' }] },
      input: [
        { type: { text: 'action-id' }, valueString: 'action-1' },
        { type: { text: 'trigger-event' }, valueString: 'invoice-due' },
        { type: { text: 'action-type' }, valueString: 'send-notification' },
        { type: { text: 'mediums' }, valueString: 'sms,email' },
      ],
    };

    const patient = {
      resourceType: 'Patient',
      id: 'pat-1',
      name: [{ given: ['John'], family: 'Doe' }],
    };

    // Count query
    mockSearch.mockResolvedValueOnce(mockBundle([], 1));
    // Data query
    mockSearch.mockResolvedValueOnce(mockBundle([task, patient]));
    // Appointment search (empty)
    mockSearch.mockResolvedValueOnce(mockBundle([]));

    const result = await handler({ headers: null, body: null, secrets: testSecrets });

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0].id).toBe('task-1');
    expect(body.tasks[0].patientName).toBe('John Doe');
    expect(body.tasks[0].actionType).toBe('send-notification');
    expect(body.tasks[0].triggerEvent).toBe('invoice-due');
    expect(body.tasks[0].mediums).toBe('sms,email');
    expect(body.totalCount).toBe(1);
  });

  it('returns empty list when no tasks exist', async () => {
    mockSearch.mockResolvedValueOnce(mockBundle([], 0));
    mockSearch.mockResolvedValueOnce(mockBundle([]));

    const result = await handler({ headers: null, body: null, secrets: testSecrets });

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.tasks).toEqual([]);
    expect(body.totalCount).toBe(0);
  });

  it('applies status filter from request body', async () => {
    mockSearch.mockResolvedValueOnce(mockBundle([], 0));
    mockSearch.mockResolvedValueOnce(mockBundle([]));

    await handler({
      headers: null,
      body: JSON.stringify({ status: 'draft' }),
      secrets: testSecrets,
    });

    // Verify the search params include the status filter
    const countSearchCall = mockSearch.mock.calls[0][0];
    expect(countSearchCall.params).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'status', value: 'draft' })])
    );
  });

  it('handles charge-card mediums extraction', async () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-cc',
      status: 'completed',
      intent: 'order',
      for: { reference: 'Patient/pat-1' },
      focus: { reference: 'Encounter/enc-1' },
      executionPeriod: { start: '2025-02-01T10:00:00Z' },
      authoredOn: '2025-01-15T10:00:00Z',
      description: 'Outreach: Charge Credit Card',
      code: { coding: [{ system: 'https://ottehr.com/CodeSystem/outreach-action-type', code: 'charge-card' }] },
      meta: { tag: [{ system: 'https://fhir.ottehr.com/r4/outreach-task', code: 'invoice-due' }] },
      input: [
        { type: { text: 'action-id' }, valueString: 'cc-1' },
        { type: { text: 'trigger-event' }, valueString: 'invoice-due' },
        { type: { text: 'action-type' }, valueString: 'charge-card' },
        {
          type: { text: 'charge-card-config' },
          valueString: JSON.stringify({
            retryAttempts: 2,
            retryIntervalDays: 3,
            onSuccess: { enabled: true, mediums: ['sms'] },
            onFailure: { enabled: true, mediums: ['email'] },
          }),
        },
      ],
    };

    const patient = { resourceType: 'Patient', id: 'pat-1', name: [{ given: ['Jane'], family: 'Smith' }] };

    // count search, data search (no appointments in basedOn, so no appointment search)
    mockSearch.mockResolvedValueOnce(mockBundle([], 1));
    mockSearch.mockResolvedValueOnce(mockBundle([task, patient]));

    const result = await handler({ headers: null, body: null, secrets: testSecrets });
    const body = JSON.parse(result.body);
    expect(body.tasks[0].mediums).toContain('email');
  });

  it('extracts error message from task output', async () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-err',
      status: 'failed',
      intent: 'order',
      for: { reference: 'Patient/pat-1' },
      focus: { reference: 'Encounter/enc-1' },
      executionPeriod: { start: '2025-02-01T10:00:00Z' },
      authoredOn: '2025-01-15T10:00:00Z',
      description: 'Outreach: Send Notification',
      code: { coding: [{ system: 'https://ottehr.com/CodeSystem/outreach-action-type', code: 'send-notification' }] },
      meta: { tag: [{ system: 'https://fhir.ottehr.com/r4/outreach-task', code: 'invoice-due' }] },
      input: [
        { type: { text: 'action-type' }, valueString: 'send-notification' },
        { type: { text: 'trigger-event' }, valueString: 'invoice-due' },
        { type: { text: 'action-id' }, valueString: 'a1' },
      ],
      output: [{ type: { text: 'error' }, valueString: 'SMS delivery failed' }],
    };

    const patient = { resourceType: 'Patient', id: 'pat-1', name: [{ given: ['Bob'], family: 'Jones' }] };

    // count search, data search (no appointments in basedOn, so no appointment search)
    mockSearch.mockResolvedValueOnce(mockBundle([], 1));
    mockSearch.mockResolvedValueOnce(mockBundle([task, patient]));

    const result = await handler({ headers: null, body: null, secrets: testSecrets });
    const body = JSON.parse(result.body);

    expect(body.tasks[0].errorMessage).toBe('SMS delivery failed');
  });
});
