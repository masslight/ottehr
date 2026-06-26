import type { APIGatewayProxyResult } from 'aws-lambda';
import { PlanDefinition, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dedupeOutreachTasks } from '../../../src/cron/rcm/outreach-task-promoter/dedupe-outreach-tasks';
import { index } from '../../../src/cron/rcm/outreach-task-promoter/index';
import { parseNotificationsTimeRestriction } from '../../../src/rcm/scheduled-outreach-config/helpers';
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

vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    FEATURE_FLAGS_CONFIG: {
      automatedPatientOutreachEnabled: true,
      mailingPaperStatementsEnabled: true,
    },
  };
});

vi.mock('../../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
    createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
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
  const handler = index as ZambdaHandler;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('cancels duplicate drafts and promotes only one', async () => {
    const TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/outreach-task`;
    const tag = [
      { system: TAG_SYSTEM, code: 'discharge-time' },
      { system: `${TAG_SYSTEM}/action-id`, code: 'act-1' },
    ];
    const dupA = makeDraftTask('dup-a', {
      authoredOn: '2024-01-01T00:00:00Z',
      focus: { reference: 'Encounter/1' },
      meta: { tag },
    });
    const dupB = makeDraftTask('dup-b', {
      authoredOn: '2024-01-02T00:00:00Z',
      focus: { reference: 'Encounter/1' },
      meta: { tag },
    });
    mockSearch.mockResolvedValueOnce(mockBundle([dupA, dupB]));
    mockPatch.mockResolvedValue({});

    const result = await handler({ headers: null, body: null, secrets: testSecrets });

    const body = JSON.parse(result.body);
    expect(body.promoted).toBe(1);
    expect(body.cancelled).toBe(1);

    // One cancel patch (for the later duplicate) and one promote patch (for the earlier one)
    const cancelCall = mockPatch.mock.calls.find((c) =>
      c[0].operations.some((op: any) => op.path === '/status' && op.value === 'cancelled')
    );
    const promoteCall = mockPatch.mock.calls.find((c) =>
      c[0].operations.some((op: any) => op.path === '/status' && op.value === 'requested')
    );
    expect(cancelCall?.[0].id).toBe('dup-b');
    expect(promoteCall?.[0].id).toBe('dup-a');
  });

  it('throws when secrets are not defined', async () => {
    await expect(handler({ headers: null, body: null, secrets: null })).rejects.toThrow('Secrets are not defined');
  });
});

describe('cron-outreach-task-promoter with SMS time restriction', () => {
  const handler = index as ZambdaHandler;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks SMS tasks when outside notification window', async () => {
    // Mock DateTime.now() to a fixed time outside the narrow window to avoid flakiness
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

// ── Deduplication ────────────────────────────────────────────────────────────

describe('dedupeOutreachTasks', () => {
  const TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/outreach-task`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeKeyedTask(
    id: string,
    opts: {
      focus: string;
      triggerEvent: string;
      actionId: string;
      birthdayYear?: string;
      status?: Task['status'];
      authoredOn?: string;
    }
  ): Task {
    const tag = [
      { system: TAG_SYSTEM, code: opts.triggerEvent },
      { system: `${TAG_SYSTEM}/action-id`, code: opts.actionId },
    ];
    if (opts.birthdayYear) {
      tag.push({ system: `${TAG_SYSTEM}/birthday-year`, code: opts.birthdayYear });
    }
    return {
      resourceType: 'Task',
      id,
      status: opts.status ?? 'draft',
      intent: 'order',
      focus: { reference: opts.focus },
      authoredOn: opts.authoredOn,
      executionPeriod: { start: '2024-01-01T00:00:00Z' },
      meta: { tag },
    } as Task;
  }

  it('passes through unique tasks untouched', () => {
    const tasks = [
      makeKeyedTask('a', { focus: 'Encounter/1', triggerEvent: 'discharge-time', actionId: 'act-1' }),
      makeKeyedTask('b', { focus: 'Encounter/2', triggerEvent: 'discharge-time', actionId: 'act-1' }),
    ];
    const { tasksToProcess, tasksToCancel } = dedupeOutreachTasks(tasks);
    expect(tasksToProcess.map((t) => t.id).sort()).toEqual(['a', 'b']);
    expect(tasksToCancel).toHaveLength(0);
  });

  it('collapses duplicate drafts, keeping the earliest-authored and cancelling the rest', () => {
    const tasks = [
      makeKeyedTask('newer', {
        focus: 'Encounter/1',
        triggerEvent: 'discharge-time',
        actionId: 'act-1',
        authoredOn: '2024-01-02T00:00:00Z',
      }),
      makeKeyedTask('earlier', {
        focus: 'Encounter/1',
        triggerEvent: 'discharge-time',
        actionId: 'act-1',
        authoredOn: '2024-01-01T00:00:00Z',
      }),
    ];
    const { tasksToProcess, tasksToCancel } = dedupeOutreachTasks(tasks);
    expect(tasksToProcess.map((t) => t.id)).toEqual(['earlier']);
    expect(tasksToCancel.map((c) => c.task.id)).toEqual(['newer']);
  });

  it('keeps an already-requested duplicate and cancels only the redundant draft', () => {
    const tasks = [
      makeKeyedTask('req', {
        focus: 'Encounter/1',
        triggerEvent: 'discharge-time',
        actionId: 'act-1',
        status: 'requested',
      }),
      makeKeyedTask('draft', {
        focus: 'Encounter/1',
        triggerEvent: 'discharge-time',
        actionId: 'act-1',
        status: 'draft',
      }),
    ];
    const { tasksToProcess, tasksToCancel } = dedupeOutreachTasks(tasks);
    // The requested task is not re-processed; the draft is cancelled.
    expect(tasksToProcess).toHaveLength(0);
    expect(tasksToCancel.map((c) => c.task.id)).toEqual(['draft']);
  });

  it('treats same action-id across different birthday years as distinct', () => {
    const tasks = [
      makeKeyedTask('y2026', {
        focus: 'Patient/1',
        triggerEvent: 'patient-birthday',
        actionId: 'act-1',
        birthdayYear: '2026',
      }),
      makeKeyedTask('y2027', {
        focus: 'Patient/1',
        triggerEvent: 'patient-birthday',
        actionId: 'act-1',
        birthdayYear: '2027',
      }),
    ];
    const { tasksToProcess, tasksToCancel } = dedupeOutreachTasks(tasks);
    expect(tasksToProcess.map((t) => t.id).sort()).toEqual(['y2026', 'y2027']);
    expect(tasksToCancel).toHaveLength(0);
  });

  it('treats tasks without a derivable key as unique', () => {
    const noKeyA = { resourceType: 'Task', id: 'nk-1', status: 'draft', intent: 'order' } as Task;
    const noKeyB = { resourceType: 'Task', id: 'nk-2', status: 'draft', intent: 'order' } as Task;
    const { tasksToProcess, tasksToCancel } = dedupeOutreachTasks([noKeyA, noKeyB]);
    expect(tasksToProcess.map((t) => t.id).sort()).toEqual(['nk-1', 'nk-2']);
    expect(tasksToCancel).toHaveLength(0);
  });
});
