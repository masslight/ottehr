import type { APIGatewayProxyResult } from 'aws-lambda';
import { PlanDefinition, Task } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../../src/shared/types/common';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPatch = vi.fn();
const mockSearch = vi.fn();

const mockOystehrClient = {
  fhir: {
    create: vi.fn(),
    get: vi.fn(),
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

// Mock the config helpers to return a plan with no time restriction
vi.mock('../../../src/rcm/scheduled-outreach-config/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getOrCreateOutreachConfig: vi.fn().mockResolvedValue({
      resourceType: 'PlanDefinition',
      id: 'plan-1',
      status: 'active',
    } as PlanDefinition),
    parseNotificationsTimeRestriction: vi.fn().mockReturnValue({
      enabled: false,
      windowStart: '09:00',
      windowEnd: '21:00',
      timezone: 'America/New_York',
    }),
  };
});

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const testSecrets = { test: 'secret' };

function mockBundle(resources: any[]): { unbundle: () => any[] } {
  return { unbundle: () => resources };
}

function makeDraftTask(id: string, overrides?: Partial<Task>): Task {
  return {
    resourceType: 'Task',
    id,
    status: 'draft',
    intent: 'order',
    executionPeriod: { start: '2024-01-01T00:00:00Z' },
    ...overrides,
  } as Task;
}

describe('cron-outreach-task-promoter', () => {
  let handler: ZambdaHandler;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../../src/rcm/scheduled-outreach/cron-outreach-task-promoter/index');
    handler = mod.index as ZambdaHandler;
  });

  it('promotes draft tasks to requested status', async () => {
    const draftTask = makeDraftTask('task-1');
    mockSearch.mockResolvedValueOnce(mockBundle([draftTask]));
    mockPatch.mockResolvedValue({});

    const result = await handler({ headers: null, body: null, secrets: testSecrets });

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.promoted).toBe(1);
    expect(body.blocked).toBe(0);

    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch.mock.calls[0][0].operations).toEqual([{ op: 'replace', path: '/status', value: 'requested' }]);
  });

  it('does not patch tasks already in requested status', async () => {
    const requestedTask = makeDraftTask('task-2', { status: 'requested' });
    mockSearch.mockResolvedValueOnce(mockBundle([requestedTask]));

    const result = await handler({ headers: null, body: null, secrets: testSecrets });

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.promoted).toBe(0);
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('returns zeroes when no tasks are due', async () => {
    mockSearch.mockResolvedValueOnce(mockBundle([]));

    const result = await handler({ headers: null, body: null, secrets: testSecrets });

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.promoted).toBe(0);
    expect(body.blocked).toBe(0);
    expect(body.total).toBe(0);
  });

  it('promotes multiple draft tasks', async () => {
    const tasks = [makeDraftTask('t-1'), makeDraftTask('t-2'), makeDraftTask('t-3')];
    mockSearch.mockResolvedValueOnce(mockBundle(tasks));
    mockPatch.mockResolvedValue({});

    const result = await handler({ headers: null, body: null, secrets: testSecrets });

    const body = JSON.parse(result.body);
    expect(body.promoted).toBe(3);
    expect(mockPatch).toHaveBeenCalledTimes(3);
  });

  it('throws when secrets are not defined', async () => {
    await expect(handler({ headers: null, body: null, secrets: null })).rejects.toThrow('Secrets are not defined');
  });
});

describe('cron-outreach-task-promoter with SMS time restriction', () => {
  let handler: ZambdaHandler;
  let parseNotificationsTimeRestriction: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Re-import to get the mocked version
    const helpersModule = await import('../../../src/rcm/scheduled-outreach-config/helpers');
    parseNotificationsTimeRestriction = helpersModule.parseNotificationsTimeRestriction;

    const mod = await import('../../../src/rcm/scheduled-outreach/cron-outreach-task-promoter/index');
    handler = mod.index as ZambdaHandler;
  });

  it('blocks SMS tasks when outside notification window', async () => {
    // Mock DateTime.now() to a fixed time outside the narrow window to avoid flakiness
    const { DateTime } = await import('luxon');
    const realNow = DateTime.now;
    vi.spyOn(DateTime, 'now').mockImplementation(() =>
      realNow.call(DateTime).set({ hour: 12, minute: 0, second: 0, millisecond: 0 })
    );

    // Enable restriction with a very narrow window that won't match the mocked time (12:00 UTC)
    (parseNotificationsTimeRestriction as any).mockReturnValue({
      enabled: true,
      windowStart: '03:00',
      windowEnd: '03:01',
      timezone: 'UTC',
    });

    const smsTask = makeDraftTask('task-sms', {
      input: [{ type: { text: 'mediums' }, valueString: 'sms' }],
    });
    mockSearch.mockResolvedValueOnce(mockBundle([smsTask]));

    const result = await handler({ headers: null, body: null, secrets: testSecrets });

    const body = JSON.parse(result.body);
    expect(body.blocked).toBe(1);
    expect(body.promoted).toBe(0);
    expect(mockPatch).not.toHaveBeenCalled();
  });
});
