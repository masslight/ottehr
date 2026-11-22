import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { JournalRow as JournalRowData, JournalVisit } from 'utils/lib/types/api/provider-journal.types';
import { describe, expect, it, vi } from 'vitest';
import { JournalRow } from '../../src/features/journal/components/JournalRow';
import { JournalSideColumn } from '../../src/features/journal/components/JournalSideColumn';
import { JournalActionHandlers } from '../../src/features/journal/helpers/journalActions';
import { rowRef } from '../../src/features/journal/helpers/journalHelpers';

vi.mock('../../src/features/journal/hooks/useJournalPhoneLabels', () => ({
  useJournalPhoneLabels: () => ({ data: undefined, isLoading: false }),
}));

const NOW = DateTime.fromISO('2026-11-21T15:00:00.000Z');
const handlers: JournalActionHandlers = {
  onSelect: () => {},
  onStart: () => {},
  onText: () => {},
  onNote: () => {},
  onAddendum: () => {},
};
const comingUp = (reasonForVisit: string): JournalRowData => {
  const visit: JournalVisit = {
    appointmentId: 'appt-1',
    encounterId: 'enc-1',
    start: '2026-11-21T14:00:00Z',
    isTelemed: false,
    isFollowUp: false,
    status: 'ready for provider',
    hasProgressNote: true,
    reasonForVisit,
  };
  return {
    patient: { patientId: 'pat-ava', name: 'Ava Chen', phones: [] },
    visit,
    visits: [visit],
    items: [],
    waitingSince: '2026-11-21T14:48:00.000Z',
    room: '3',
  };
};
const renderRow = (r: JournalRowData): void => {
  render(
    <JournalRow
      rowRef={rowRef('cu', r)}
      kind="provider"
      now={NOW}
      selected={false}
      handlers={handlers}
      onSelect={() => {}}
      onOpenChat={() => {}}
    />
  );
};
const flagIcons = (): HTMLElement[] => screen.queryAllByTestId('PriorityHighRoundedIcon');

describe('flagged reason for visit, with the tracking board’s icon', () => {
  it('marks a flagged Coming Up row with the icon and hover, without the reason', async () => {
    renderRow(comingUp('Breathing problem'));
    expect(flagIcons()).toHaveLength(1);
    expect(screen.queryByText('Breathing problem')).toBeNull();
    await userEvent.hover(flagIcons()[0]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Alert clinical team for immediate evaluation');
  });

  it('leaves a Coming Up row with an ordinary reason unmarked', () => {
    renderRow(comingUp('Cough'));
    expect(flagIcons()).toHaveLength(0);
  });

  it('shows the icon and the reason in the side column', () => {
    render(
      <JournalSideColumn
        selected={rowRef('cu', comingUp('Breathing problem'))}
        kind="provider"
        now={NOW}
        actions={[]}
        onOpenChat={() => {}}
        onAddendum={() => {}}
      />
    );
    const reason = screen.getByText('Breathing problem');
    expect(within(reason).getByTestId('PriorityHighRoundedIcon')).toBeInTheDocument();
  });
});
