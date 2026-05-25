import type { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../../src/shared/types/common';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPatch = vi.fn();
const mockGet = vi.fn();
const mockSearch = vi.fn();
const mockCreate = vi.fn();

const mockOystehrClient = {
  fhir: {
    create: mockCreate,
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
    fillOutreachTemplate: vi.fn((_t: string, _p: any) => 'resolved message'),
    resolveTemplatePlaceholders: vi.fn().mockResolvedValue({}),
    sendSmsForPatient: vi.fn(),
    getEmailClient: vi.fn().mockReturnValue({ send: vi.fn() }),
    getStripeClient: vi.fn(),
  };
});

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const testSecrets = { test: 'secret' };

function makeTaskInput(overrides?: Partial<Task>): Task {
  return {
    resourceType: 'Task',
    id: 'task-1',
    status: 'requested',
    intent: 'order',
    for: { reference: 'Patient/pat-1' },
    focus: { reference: 'Encounter/enc-1' },
    input: [
      { type: { text: 'action-id' }, valueString: 'action-1' },
      { type: { text: 'trigger-event' }, valueString: 'invoice-due' },
      { type: { text: 'action-type' }, valueString: 'send-notification' },
      { type: { text: 'mediums' }, valueString: 'sms' },
      { type: { text: 'sms-template' }, valueString: 'Pay your bill' },
    ],
    ...overrides,
  } as Task;
}

function makeZambdaInput(task: Task): ZambdaInput {
  return {
    headers: null,
    body: JSON.stringify(task),
    secrets: testSecrets,
  };
}

// ── Executor: sub-outreach-log ─────────────────────────────────────────────

describe('sub-outreach-log', () => {
  let handler: ZambdaHandler;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../../src/subscriptions/task/sub-outreach-log/index');
    handler = mod.index as ZambdaHandler;
  });

  it('marks task as in-progress then completed', async () => {
    const task = makeTaskInput({ input: [{ type: { text: 'action-type' }, valueString: 'log' }] });
    const result = await handler(makeZambdaInput(task));

    expect(result.statusCode).toBe(200);
    expect(mockPatch).toHaveBeenCalledTimes(2);

    // First call: in-progress
    expect(mockPatch.mock.calls[0][0].operations).toEqual(
      expect.arrayContaining([expect.objectContaining({ op: 'replace', path: '/status', value: 'in-progress' })])
    );

    // Second call: completed
    expect(mockPatch.mock.calls[1][0].operations).toEqual(
      expect.arrayContaining([expect.objectContaining({ op: 'replace', path: '/status', value: 'completed' })])
    );
  });

  it('skips tasks not in "requested" status', async () => {
    const task = makeTaskInput({ status: 'draft' });
    const result = await handler(makeZambdaInput(task));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toContain('not in requested status');
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('marks task as failed on error', async () => {
    const task = makeTaskInput();
    mockPatch
      .mockResolvedValueOnce({}) // in-progress succeeds
      .mockRejectedValueOnce(new Error('FHIR error')); // completed fails

    // The outer catch should mark as failed
    mockPatch.mockResolvedValueOnce({}); // failed status

    const result = await handler(makeZambdaInput(task));
    expect(result.statusCode).toBe(500);
  });

  it('throws when body is missing', async () => {
    await expect(handler({ headers: null, body: null, secrets: testSecrets })).rejects.toThrow(
      'No request body provided'
    );
  });

  it('throws when secrets are missing', async () => {
    const task = makeTaskInput();
    await expect(handler({ headers: null, body: JSON.stringify(task), secrets: null })).rejects.toThrow(
      'Secrets are not defined'
    );
  });

  it('throws when resource type is not Task', async () => {
    const notATask = { resourceType: 'Patient', id: 'pat-1' };
    await expect(handler({ headers: null, body: JSON.stringify(notATask), secrets: testSecrets })).rejects.toThrow(
      'Expected Task resource'
    );
  });
});

// ── Executor: sub-outreach-refer-to-collections ─────────────────────────────

describe('sub-outreach-refer-to-collections', () => {
  let handler: ZambdaHandler;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../../src/subscriptions/task/sub-outreach-refer-to-collections/index');
    handler = mod.index as ZambdaHandler;
  });

  it('marks task as in-progress then rejected (not yet implemented)', async () => {
    const task = makeTaskInput({
      input: [
        { type: { text: 'action-type' }, valueString: 'refer-to-collections' },
        {
          type: { text: 'refer-to-collections-config' },
          valueString: JSON.stringify({ agency: 'IC System', minimumBalance: 50, includePaymentHistory: true }),
        },
      ],
    });

    const result = await handler(makeZambdaInput(task));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).status).toBe('rejected');
    expect(JSON.parse(result.body).reason).toBe('not-yet-implemented');
    expect(mockPatch).toHaveBeenCalledTimes(2);
  });

  it('skips tasks not in "requested" status', async () => {
    const task = makeTaskInput({ status: 'completed' });
    const result = await handler(makeZambdaInput(task));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toContain('not in requested status');
  });
});
