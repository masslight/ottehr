import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { JournalItem, JournalRow as JournalRowData, JournalVisit } from 'utils/lib/types/api/provider-journal.types';
import { describe, expect, it, vi } from 'vitest';
import { JournalRow } from '../../src/features/journal/components/JournalRow';
import { JournalSideColumn } from '../../src/features/journal/components/JournalSideColumn';
import { JournalAction } from '../../src/features/journal/helpers/journalActions';
import { rowRef, summarizeItems } from '../../src/features/journal/helpers/journalHelpers';

const NOW = DateTime.fromISO('2026-11-21T15:00:00.000Z');
const visit: JournalVisit = {
  appointmentId: 'appt-1',
  encounterId: 'enc-1',
  start: '2026-11-21T14:00:00Z',
  isTelemed: false,
  isFollowUp: false,
  status: 'ready for provider',
  hasProgressNote: true,
};
const item = (id: string, label: string, assignedTo?: string): JournalItem => ({
  id,
  taskId: id,
  kind: 'task',
  label,
  when: 'created',
  since: '2026-11-21T13:00:00.000Z',
  encounterId: 'enc-1',
  assignedTo,
});
const row = (overrides: Partial<JournalRowData> = {}): JournalRowData => ({
  patient: { patientId: 'pat-ava', name: 'Ava Chen', phones: [] },
  visit,
  visits: [visit],
  items: [item('mine', 'Call about culture results'), item('theirs', 'Call pharmacy', 'Joe Lin')],
  waitingSince: '2026-11-21T14:50:00.000Z',
  room: '3',
  ...overrides,
});
const side = (r: JournalRowData, actions: JournalAction[] = [], kind: 'provider' | 'clinician' = 'provider'): void => {
  render(
    <JournalSideColumn
      selected={rowRef('cu', r)}
      kind={kind}
      now={NOW}
      actions={actions}
      onOpenChat={() => {}}
      onAddendum={() => {}}
    />
  );
};

describe('OTR-3941 review answers', () => {
  it("lists a Coming Up row's to-dos after the wait, on the row and in the side column", () => {
    render(
      <JournalRow
        rowRef={rowRef('cu', row())}
        kind="provider"
        now={NOW}
        selected={false}
        handlers={{ onSelect: () => {}, onStart: () => {}, onText: () => {}, onNote: () => {}, onAddendum: () => {} }}
        onSelect={() => {}}
        onOpenChat={() => {}}
      />
    );
    expect(screen.getByText(/Waiting/)).toBeInTheDocument();
    // A general task opens its Task notes, so it's a button.
    expect(screen.getByRole('button', { name: 'Call about culture results' })).toBeInTheDocument();
  });

  it('shows a task held by someone else with their name, apart under "Assigned to others"', () => {
    side(row());
    const heading = screen.getByText('Assigned to others');
    expect(heading.nextElementSibling).toHaveTextContent('Call pharmacy, assigned to Joe Lin 2h ago');
    expect(screen.getAllByRole('button', { name: 'Call pharmacy' })).toHaveLength(1);
  });

  it("leaves someone else's task out of the row's action count", () => {
    expect(summarizeItems(row().items)).toBe(summarizeItems([row().items[0]]));
  });

  it('labels look-ahead rows by journal kind', () => {
    side(row({ lookahead: true, waitingSince: undefined, items: [] }), [], 'clinician');
    expect(screen.getByText('Arrived, next up')).toBeInTheDocument();
  });

  it('opens the Progress Note from the main button and takes over from the ▾ menu', async () => {
    const onClick = vi.fn();
    side(row({ items: [] }), [
      {
        key: 'progress',
        label: 'Progress Note',
        tooltip: 'Progress Note',
        icon: null,
        href: '/in-person/appt-1/review-and-sign',
        menu: [{ label: 'Make me provider and open note', onClick }],
      },
    ]);
    expect(screen.getByRole('link', { name: 'Progress Note' })).toHaveAttribute(
      'href',
      '/in-person/appt-1/review-and-sign'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Progress Note options' }));
    await userEvent.click(within(screen.getByRole('menu')).getByText('Make me provider and open note'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
