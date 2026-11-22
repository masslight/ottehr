import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { JournalRow as JournalRowData } from 'utils/lib/types/api/provider-journal.types';
import { describe, expect, it } from 'vitest';
import { JournalRow } from '../../src/features/journal/components/JournalRow';
import { JournalActionHandlers } from '../../src/features/journal/helpers/journalActions';
import { rowRef } from '../../src/features/journal/helpers/journalHelpers';

const handlers: JournalActionHandlers = {
  onSelect: () => {},
  onStart: () => {},
  onText: () => {},
  onNote: () => {},
  onAddendum: () => {},
};
const data: JournalRowData = {
  patient: { patientId: 'pat-1', name: 'Ava Chen', phones: [] },
  visits: [],
  items: [
    { id: 't1', taskId: 't1', kind: 'task', label: 'Call pharmacy', when: 'assigned', since: '2026-11-21T12:00:00Z' },
  ],
};

const renderRow = (rowHandlers = handlers): void => {
  render(
    <JournalRow
      rowRef={rowRef('np', data)}
      kind="provider"
      now={DateTime.fromISO('2026-11-21T15:00:00Z')}
      selected={false}
      handlers={rowHandlers}
      onSelect={() => {}}
      onOpenChat={() => {}}
    />
  );
};

describe('journal row icon hover popups', () => {
  it('show the name of the icon under the pointer, and move with it', async () => {
    renderRow();
    await userEvent.hover(screen.getByRole('button', { name: 'Add a Free Form' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Add a Free Form');
    await userEvent.hover(screen.getByRole('link', { name: 'Patient Record' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Patient Record');
    await userEvent.unhover(screen.getByRole('link', { name: 'Patient Record' }).parentElement!);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('say why a disabled icon is disabled', async () => {
    renderRow();
    // No phone on file, so Text is disabled.
    const text = screen.getByRole('button', { name: 'Text the patient' });
    await userEvent.hover(text.parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('No phone number on file');
  });

  it('show on keyboard focus, and a click on an icon still works the first time', async () => {
    const opened: string[] = [];
    renderRow({ ...handlers, onNote: () => opened.push('note') });
    const note = screen.getByRole('button', { name: 'Add a Free Form' });
    await act(async () => note.focus());
    expect(document.activeElement).toBe(note);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Add a Free Form');
    await userEvent.click(note);
    expect(opened).toEqual(['note']);
  });
});
