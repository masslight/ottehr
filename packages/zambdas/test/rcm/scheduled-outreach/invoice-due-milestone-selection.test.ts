import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { selectApplicableInvoiceDueActionIds } from '../../../src/rcm/scheduled-outreach/producers/shared/produce-invoice-due-outreach';
import type { ActionType, OutreachAction } from '../../../src/rcm/scheduled-outreach-config/helpers';

function makeAction(id: string, daysAfter: number, actionType: ActionType = 'send-notification'): OutreachAction {
  return {
    id,
    trigger: { event: 'invoice-due', daysAfter, timeUnit: 'days', direction: 'after' },
    actionType,
  };
}

// dueDate N days before "now" → invoice is N days past due.
function dueDateDaysAgo(days: number): string {
  return DateTime.now().startOf('day').minus({ days }).toISODate()!;
}

describe('selectApplicableInvoiceDueActionIds', () => {
  it('keeps only the latest elapsed milestone when an invoice is first seen past several', () => {
    const actions = [makeAction('a8', 8), makeAction('a22', 22)];
    // Invoice is 22 days past due: both 8-day and 22-day milestones have elapsed.
    const survivors = selectApplicableInvoiceDueActionIds(actions, dueDateDaysAgo(22));
    expect([...survivors]).toEqual(['a22']);
  });

  it('selects the single milestone applicable on its own day', () => {
    const actions = [makeAction('a8', 8), makeAction('a22', 22)];
    // Exactly 8 days past due: only the 8-day milestone has elapsed.
    const survivors = selectApplicableInvoiceDueActionIds(actions, dueDateDaysAgo(8));
    expect([...survivors]).toEqual(['a8']);
  });

  it('excludes future (not-yet-elapsed) milestones', () => {
    const actions = [makeAction('a8', 8), makeAction('a22', 22)];
    // 10 days past due: 8-day elapsed, 22-day still in the future.
    const survivors = selectApplicableInvoiceDueActionIds(actions, dueDateDaysAgo(10));
    expect([...survivors]).toEqual(['a8']);
  });

  it('returns an empty set when no milestone has elapsed yet', () => {
    const actions = [makeAction('a8', 8), makeAction('a22', 22)];
    // 3 days past due: neither milestone has elapsed.
    const survivors = selectApplicableInvoiceDueActionIds(actions, dueDateDaysAgo(3));
    expect(survivors.size).toBe(0);
  });

  it('suppresses earlier milestones independently per action type', () => {
    const actions = [
      makeAction('note8', 8, 'send-notification'),
      makeAction('note22', 22, 'send-notification'),
      makeAction('charge5', 5, 'charge-card'),
    ];
    // 22 days past due: latest notification is the 22-day; the 5-day charge-card still applies
    // because it is the latest elapsed milestone of its own action type.
    const survivors = selectApplicableInvoiceDueActionIds(actions, dueDateDaysAgo(22));
    expect([...survivors].sort()).toEqual(['charge5', 'note22']);
  });

  it('keeps ties when two same-type actions share the latest elapsed offset', () => {
    const actions = [makeAction('a22a', 22), makeAction('a22b', 22)];
    const survivors = selectApplicableInvoiceDueActionIds(actions, dueDateDaysAgo(25));
    expect([...survivors].sort()).toEqual(['a22a', 'a22b']);
  });
});
