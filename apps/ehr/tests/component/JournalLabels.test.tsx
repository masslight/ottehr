import { JournalRow, JournalVisit } from 'utils/lib/types/api/provider-journal.types';
import { describe, expect, it, vi } from 'vitest';
import { buildJournalActions } from '../../src/features/journal/helpers/journalActions';
import { rowRef, visitHeading } from '../../src/features/journal/helpers/journalHelpers';

const visit = (isTelemed: boolean): JournalVisit => ({
  appointmentId: 'appt-1',
  encounterId: 'enc-1',
  start: '2026-11-20T14:00:00Z',
  isTelemed,
  isFollowUp: false,
  status: 'provider',
  hasProgressNote: false,
});

describe('journal labels use Ottehr names', () => {
  it('names the row actions as develop does (Patient Record, Progress Note, Visit Details, Free Form)', () => {
    const row: JournalRow = {
      patient: { patientId: 'pat-1', name: 'Ida Notied', phones: [] },
      visit: visit(false),
      visits: [],
      items: [],
    };
    const handlers = { onSelect: vi.fn(), onStart: vi.fn(), onText: vi.fn(), onNote: vi.fn(), onAddendum: vi.fn() };
    const actions = buildJournalActions(rowRef('td', row), 'provider', handlers);
    const byKey = (key: string): { label: string; tooltip: string; disabledReason?: string } | undefined =>
      actions.find((a) => a.key === key);
    expect(byKey('record')).toMatchObject({ label: 'Patient Record', tooltip: 'Patient Record' });
    expect(byKey('progress')).toMatchObject({ label: 'Progress Note', tooltip: 'Progress Note' });
    expect(byKey('details')).toMatchObject({ label: 'Visit Details', tooltip: 'Visit Details' });
    expect(byKey('note')).toMatchObject({ label: 'Free Form', tooltip: 'Add a Free Form' });
    expect(byKey('addendum')).toMatchObject({
      tooltip: 'Add an addendum to the Progress Note',
      disabledReason: 'No Progress Note yet',
    });
  });

  it("uses the tracking board's visit-type words (In Person, Virtual)", () => {
    expect(visitHeading(visit(false))).toContain(' · In Person');
    expect(visitHeading(visit(true))).toContain(' · Virtual');
  });
});
