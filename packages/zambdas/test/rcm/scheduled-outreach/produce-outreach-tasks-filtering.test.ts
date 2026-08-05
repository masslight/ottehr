import { FEATURE_FLAGS_CONFIG } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { produceOutreachTasks } from '../../../src/rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';
import {
  getOrCreateOutreachConfig,
  type OutreachAction,
  parsePlanDefinitionToActions,
} from '../../../src/rcm/scheduled-outreach-config/helpers';

// FEATURE_FLAGS_CONFIG, getOrCreateOutreachConfig, and parsePlanDefinitionToActions are canonical
// suite-wide mocks (vitest.unit-mocks.setup.ts); behavior is installed per-test via vi.mocked(...).

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockSearch = vi.fn();

const mockOystehrClient = {
  fhir: {
    create: mockCreate,
    search: mockSearch,
    get: vi.fn(),
    update: vi.fn(),
    patch: vi.fn(),
    transaction: vi.fn(),
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function mockBundle(resources: any[]): { unbundle: () => any[]; total: number; link: never[] } {
  return { unbundle: () => resources, total: resources.length, link: [] };
}

function makeAction(overrides?: Partial<OutreachAction>): OutreachAction {
  return {
    id: 'action-1',
    trigger: { event: 'invoice-due', daysAfter: 7, timeUnit: 'days', direction: 'after' },
    actionType: 'send-notification',
    sendNotificationConfig: {
      mediums: ['sms'],
      smsTemplate: 'Pay now!',
      emailTemplate: '',
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('produceOutreachTasks — producer-level filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(FEATURE_FLAGS_CONFIG, {
      automatedPatientOutreachEnabled: true,
      mailingPaperStatementsEnabled: true,
    });

    vi.mocked(getOrCreateOutreachConfig).mockResolvedValue({
      resourceType: 'PlanDefinition',
      id: 'plan-1',
      status: 'active',
    });
    mockSearch.mockResolvedValue(mockBundle([])); // no existing tasks
    mockCreate.mockImplementation((task: any) => Promise.resolve({ ...task, id: 'task-new' }));
  });

  it('skips refer-to-collections actions (not yet implemented)', async () => {
    const actions: OutreachAction[] = [
      makeAction({
        id: 'collections-1',
        actionType: 'refer-to-collections',
        referToCollectionsConfig: { agency: 'Acme', minimumBalance: 100, includePaymentHistory: true },
      }),
      makeAction({ id: 'sms-1', actionType: 'send-notification' }),
    ];
    vi.mocked(parsePlanDefinitionToActions).mockReturnValue(actions);

    const result = await produceOutreachTasks({
      triggerEvent: 'invoice-due',
      patient: { reference: 'Patient/pat-1' },
      focus: { reference: 'Invoice/inv-1' },
      eventTimestamp: '2025-01-15T10:00:00.000Z',
      oystehr: mockOystehrClient as any,
    });

    expect(result.skipped).toContainEqual({
      actionId: 'collections-1',
      reason: 'refer-to-collections is not yet implemented',
    });
    // SMS action should still be created
    expect(result.created).toHaveLength(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('skips paper-mail-only notification when mailingPaperStatementsEnabled is false', async () => {
    Object.assign(FEATURE_FLAGS_CONFIG, { mailingPaperStatementsEnabled: false });

    const actions: OutreachAction[] = [
      makeAction({
        id: 'paper-only',
        actionType: 'send-notification',
        sendNotificationConfig: { mediums: ['paper-mail'], smsTemplate: '', emailTemplate: '' },
      }),
      makeAction({ id: 'sms-1', actionType: 'send-notification' }),
    ];
    vi.mocked(parsePlanDefinitionToActions).mockReturnValue(actions);

    const result = await produceOutreachTasks({
      triggerEvent: 'invoice-due',
      patient: { reference: 'Patient/pat-1' },
      focus: { reference: 'Invoice/inv-1' },
      eventTimestamp: '2025-01-15T10:00:00.000Z',
      oystehr: mockOystehrClient as any,
    });

    expect(result.skipped).toContainEqual({
      actionId: 'paper-only',
      reason: 'Paper mail feature is disabled',
    });
    expect(result.created).toHaveLength(1);
  });

  it('does NOT skip paper-mail notification when feature is enabled', async () => {
    Object.assign(FEATURE_FLAGS_CONFIG, { mailingPaperStatementsEnabled: true });

    const actions: OutreachAction[] = [
      makeAction({
        id: 'paper-only',
        actionType: 'send-notification',
        sendNotificationConfig: { mediums: ['paper-mail'], smsTemplate: '', emailTemplate: '' },
      }),
    ];
    vi.mocked(parsePlanDefinitionToActions).mockReturnValue(actions);

    const result = await produceOutreachTasks({
      triggerEvent: 'invoice-due',
      patient: { reference: 'Patient/pat-1' },
      focus: { reference: 'Invoice/inv-1' },
      eventTimestamp: '2025-01-15T10:00:00.000Z',
      oystehr: mockOystehrClient as any,
    });

    expect(result.skipped).toHaveLength(0);
    expect(result.created).toHaveLength(1);
  });

  it('does NOT skip multi-medium notification that includes paper-mail when feature is disabled', async () => {
    Object.assign(FEATURE_FLAGS_CONFIG, { mailingPaperStatementsEnabled: false });

    const actions: OutreachAction[] = [
      makeAction({
        id: 'multi-medium',
        actionType: 'send-notification',
        sendNotificationConfig: { mediums: ['sms', 'paper-mail'], smsTemplate: 'hi', emailTemplate: '' },
      }),
    ];
    vi.mocked(parsePlanDefinitionToActions).mockReturnValue(actions);

    const result = await produceOutreachTasks({
      triggerEvent: 'invoice-due',
      patient: { reference: 'Patient/pat-1' },
      focus: { reference: 'Invoice/inv-1' },
      eventTimestamp: '2025-01-15T10:00:00.000Z',
      oystehr: mockOystehrClient as any,
    });

    // Task still created because it has SMS too — executor handles the partial paper-mail skip
    expect(result.skipped).toHaveLength(0);
    expect(result.created).toHaveLength(1);
  });
});
