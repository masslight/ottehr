import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { RcmTaskCodings } from 'utils/lib/fhir/constants';
import { describe, expect, it, vi } from 'vitest';
import {
  OUTREACH_ACTION_TYPE_SYSTEM,
  OUTREACH_TASK_TAG_SYSTEM,
} from '../../src/rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';
import { isBillingTask, performEffect } from '../../src/subscriptions/task/sub-billing-task-history';

const outreachTask = (action: string, triggerEvent: string): Task => ({
  resourceType: 'Task',
  id: 'outreach-1',
  status: 'draft',
  intent: 'order',
  code: {
    coding: [
      {
        system: OUTREACH_ACTION_TYPE_SYSTEM,
        code: action,
      },
    ],
  },
  meta: {
    versionId: '1',
    tag: [
      {
        system: OUTREACH_TASK_TAG_SYSTEM,
        code: triggerEvent,
      },
    ],
  },
});

const version = (versionId: string, lastUpdated: string, status: Task['status']): Task => ({
  resourceType: 'Task',
  id: 'invoice-1',
  status,
  intent: 'order',
  code: RcmTaskCodings.sendInvoiceToPatient,
  meta: {
    versionId,
    lastUpdated,
  },
});

const makeOystehr = (history: Task[]): { oystehr: Oystehr; execute: ReturnType<typeof vi.fn> } => {
  const execute = vi.fn().mockResolvedValue({});
  return {
    oystehr: {
      fhir: {
        history: vi.fn().mockResolvedValue({
          entry: history.map((resource) => ({
            resource,
          })),
        }),
      },
      zambda: {
        execute,
      },
    } as unknown as Oystehr,
    execute,
  };
};

describe('sub-billing-task-history isBillingTask', () => {
  it.each([
    ['a notification about an issued invoice', true, outreachTask('send-notification', 'invoice-issued')],
    ['a notification about a past-due invoice', true, outreachTask('send-notification', 'invoice-due')],
    ['a card charge, whatever triggered it', true, outreachTask('charge-card', 'discharge-time')],
    ['a collections referral', true, outreachTask('refer-to-collections', 'invoice-due')],
    ['a birthday greeting', false, outreachTask('send-notification', 'patient-birthday')],
    ['a visit follow-up log', false, outreachTask('log', 'discharge-time')],
    ['an invoice task', true, version('1', '2026-10-01T00:00:00Z', 'ready')],
  ])('treats %s as billing: %s', (_description, expected, task) => {
    expect(isBillingTask(task)).toBe(expected);
  });
});

describe('sub-billing-task-history performEffect', () => {
  it('hands the billing app the version and the one written before it', async () => {
    const current = version('3', '2026-10-03T00:00:00Z', 'completed');
    const previous = version('2', '2026-10-02T00:00:00Z', 'in-progress');
    const { oystehr, execute } = makeOystehr([previous, current, version('1', '2026-10-01T00:00:00Z', 'ready')]);

    await performEffect(oystehr, current);

    expect(execute).toHaveBeenCalledWith({
      id: 'record-billing-task-history',
      task: current,
      previousTask: previous,
    });
  });

  it('hands over a new Task alone', async () => {
    const created = version('1', '2026-10-01T00:00:00Z', 'ready');
    const { oystehr, execute } = makeOystehr([created]);

    await performEffect(oystehr, created);

    expect(execute).toHaveBeenCalledWith({
      id: 'record-billing-task-history',
      task: created,
    });
  });
});
