import { JournalItem, JournalRow, JournalVisit } from 'utils/lib/types/api/provider-journal.types';
import { describe, expect, it, vi } from 'vitest';
import { buildJournalActions, JournalAction } from '../../src/features/journal/helpers/journalActions';
import { JournalSectionKey, rowRef } from '../../src/features/journal/helpers/journalHelpers';

const visit = (id: string, overrides: Partial<JournalVisit> = {}): JournalVisit => ({
  appointmentId: `appt-${id}`,
  encounterId: `enc-${id}`,
  start: '2026-11-20T14:00:00Z',
  isTelemed: false,
  isFollowUp: false,
  status: 'provider',
  hasProgressNote: true,
  ...overrides,
});
const todo = (encounterId: string): JournalItem => ({
  id: `task-${encounterId}`,
  kind: 'task',
  label: 'Call about culture results',
  when: 'created',
  since: '2026-11-17T14:00:00Z',
  encounterId,
});
const handlers = { onSelect: vi.fn(), onStart: vi.fn(), onText: vi.fn(), onNote: vi.fn(), onAddendum: vi.fn() };
const actions = (
  section: JournalSectionKey,
  row: JournalRow,
  kind: 'provider' | 'clinician' = 'provider'
): JournalAction[] => buildJournalActions(rowRef(section, row), kind, handlers);
const byKey = (list: JournalAction[], key: string): JournalAction | undefined => list.find((a) => a.key === key);
const patient = { patientId: 'pat-cal', name: 'Cal Room', phones: [] };

describe('journal row actions and the row visits', () => {
  it("opens today's visit from a Today row's Progress Note and Visit Details, not an older to-do's visit", () => {
    const older = visit('old', { start: '2026-11-17T14:00:00Z', status: 'completed' });
    const today = visit('today');
    const row: JournalRow = { patient, visit: today, visits: [today, older], items: [todo('enc-old')] };
    const list = actions('td', row);
    expect(byKey(list, 'progress')?.href).toBe('/in-person/appt-today/review-and-sign');
    expect(byKey(list, 'details')?.href).toBe('/visit/appt-today');
    expect(byKey(list, 'followup')?.href).toContain('encounter=enc-today');
  });

  it('disables Progress Note with the same hover as Addendum while the visit has no note yet', () => {
    const ready = visit('ready', { status: 'ready', hasProgressNote: false });
    const list = actions('cu', { patient, visit: ready, visits: [ready], items: [] }, 'clinician');
    expect(byKey(list, 'progress')?.disabledReason).toBe('No Progress Note yet');
    expect(byKey(list, 'addendum')?.disabledReason).toBe('No Progress Note yet');
    const seen = visit('seen');
    expect(byKey(actions('td', { patient, visit: seen, visits: [seen], items: [] }), 'progress')?.disabledReason).toBe(
      undefined
    );
  });

  it("enables Addendum on a completed visit of the row when its only to-do is on another provider's visit", () => {
    const completed = visit('jay', { start: '2026-11-08T14:00:00Z', status: 'completed' });
    // The text is linked to a visit that isn't on this journal.
    const row: JournalRow = { patient, visits: [completed], items: [todo('enc-elsewhere')] };
    const addendum = byKey(actions('rc', row), 'addendum');
    expect(addendum?.disabledReason).toBeUndefined();
    addendum?.onClick?.();
    expect(handlers.onAddendum).toHaveBeenCalledWith(row, completed);
  });

  it("skips a to-do's upcoming booking and uses the row's started visit for the chart links", () => {
    const booking = visit('next', { start: '2026-11-27T14:00:00Z', status: 'pending', hasProgressNote: false });
    const today = visit('today', { status: 'discharged' });
    handlers.onAddendum.mockClear();
    const todayRow: JournalRow = { patient, visit: today, visits: [booking, today], items: [todo('enc-next')] };
    byKey(actions('td', todayRow), 'addendum')?.onClick?.();
    expect(handlers.onAddendum).toHaveBeenCalledWith(todayRow, today);

    const last = visit('last', { start: '2026-11-06T14:00:00Z', status: 'completed' });
    handlers.onAddendum.mockClear();
    const recentRow: JournalRow = { patient, visits: [booking, last], items: [todo('enc-next')] };
    const recent = actions('rc', recentRow);
    expect(byKey(recent, 'progress')?.href).toBe('/in-person/appt-last/review-and-sign');
    expect(byKey(recent, 'details')?.href).toBe('/visit/appt-last');
    expect(byKey(recent, 'followup')?.href).toContain('encounter=enc-last');
    const addendum = byKey(recent, 'addendum');
    expect(addendum?.disabledReason).toBeUndefined();
    addendum?.onClick?.();
    expect(handlers.onAddendum).toHaveBeenCalledWith(recentRow, last);
  });

  it("gives a clinician's virtual Ready row Start Intake, as the tracking board does; the provider's opens the chart", () => {
    const ready = visit('tm', { status: 'ready', isTelemed: true, hasProgressNote: false });
    const clinician = actions('cu', { patient, visit: ready, visits: [ready], items: [] }, 'clinician');
    expect(byKey(clinician, 'start')?.label).toBe('Start Intake');
    expect(byKey(clinician, 'join')).toBeUndefined();
    const rfp = { ...ready, status: 'ready for provider' as const };
    const provider = actions('cu', { patient, visit: rfp, visits: [rfp], items: [] });
    // The tracking board's label for a virtual visit ready for the provider; it opens the chart, no status change.
    expect(byKey(provider, 'join')?.label).toBe('Start Provider');
    expect(byKey(provider, 'join')?.tooltip).toBe('Start Provider (opens the chart in a new tab)');
    expect(byKey(provider, 'start')).toBeUndefined();
  });
});
