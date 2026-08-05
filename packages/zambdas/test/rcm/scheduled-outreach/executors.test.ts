import type { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  fillOutreachTemplate,
  getEmailClient,
  getStripeClient,
  resolveTemplatePlaceholders,
  sendSmsForPatient,
} from '../../../src/shared';
import type { ZambdaInput } from '../../../src/shared/types/common';
import { index as subOutreachLogIndex } from '../../../src/subscriptions/task/sub-outreach-log/index';
import { index as subOutreachReferToCollectionsIndex } from '../../../src/subscriptions/task/sub-outreach-refer-to-collections/index';

// All the src/shared exports stubbed here are canonical suite-wide mocks
// (vitest.unit-mocks.setup.ts); per-file defaults are installed in beforeEach below.
// The REAL wrapHandler now wraps the handlers, so plain thrown errors surface as a
// 500 error envelope instead of a rejected promise.

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkOrCreateM2MClientToken).mockResolvedValue('mock-token');
  vi.mocked(createClinicalOystehrClient).mockReturnValue(mockOystehrClient as any);
  vi.mocked(fillOutreachTemplate).mockReturnValue('resolved message');
  vi.mocked(resolveTemplatePlaceholders).mockResolvedValue({} as any);
  vi.mocked(sendSmsForPatient).mockImplementation(() => undefined as never);
  vi.mocked(getEmailClient).mockReturnValue({ send: vi.fn() } as any);
  vi.mocked(getStripeClient).mockImplementation(() => undefined as never);
});

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const testSecrets = { test: 'secret', ENVIRONMENT: 'local' };

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
  const handler = subOutreachLogIndex as unknown as ZambdaHandler;

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

  it('returns a 500 error envelope when body is missing', async () => {
    // The real wrapHandler converts the thrown 'No request body provided' into an error envelope
    const result = await handler({ headers: null, body: null, secrets: testSecrets });
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ error: 'Internal error' });
  });

  it('throws when secrets are missing', async () => {
    // configSentry reads the ENVIRONMENT secret before the top-level catch,
    // so a null-secrets invocation still rejects.
    const task = makeTaskInput();
    await expect(handler({ headers: null, body: JSON.stringify(task), secrets: null })).rejects.toThrow();
  });

  it('returns a 500 error envelope when resource type is not Task', async () => {
    const notATask = { resourceType: 'Patient', id: 'pat-1' };
    const result = await handler({ headers: null, body: JSON.stringify(notATask), secrets: testSecrets });
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ error: 'Internal error' });
    expect(mockPatch).not.toHaveBeenCalled();
  });
});

// ── Executor: sub-outreach-refer-to-collections ─────────────────────────────

describe('sub-outreach-refer-to-collections', () => {
  const handler = subOutreachReferToCollectionsIndex as unknown as ZambdaHandler;

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
