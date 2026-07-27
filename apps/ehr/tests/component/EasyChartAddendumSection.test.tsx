import { render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import { NOTE_TYPE, NoteDTO } from 'utils';
import { describe, expect, it } from 'vitest';
import { AddendumSection, hasAddendaToShow } from '../../src/features/easy-charting/AddendumSection';

// The easy-chart note's Addendum block is a compact read-only mirror of Review & Sign's
// AddendumCard: per-author addendum NoteDTOs (author · local date, edited marker, tombstones
// hidden) plus the legacy single-string addendum.
describe('AddendumSection', () => {
  const lastUpdatedIso = '2026-07-02T09:15:00.000Z';
  const base: NoteDTO = {
    type: NOTE_TYPE.ADDENDUM,
    resourceId: 'add-1',
    patientId: 'p-1',
    encounterId: 'e-1',
    text: 'Patient called back — symptoms resolved.',
    authorId: 'u-1',
    authorName: 'Dr. Quinn',
    lastUpdated: lastUpdatedIso,
  };

  it('renders addendum text with author and local-timezone date', () => {
    render(<AddendumSection notes={[base]} />);
    expect(screen.getByText('Addendum')).toBeDefined();
    expect(screen.getByText('Patient called back — symptoms resolved.')).toBeDefined();
    const expectedDate = DateTime.fromISO(lastUpdatedIso).toFormat('MM/dd/yyyy h:mm a');
    expect(screen.getByText(`Dr. Quinn · ${expectedDate}`)).toBeDefined();
  });

  it('marks edited addenda and hides soft-deleted ones', () => {
    const edited: NoteDTO = { ...base, resourceId: 'add-2', text: 'Amended dosage note.', edited: true };
    const deleted: NoteDTO = { ...base, resourceId: 'add-3', text: 'Removed entry.', deleted: true };
    render(<AddendumSection notes={[edited, deleted]} />);
    expect(screen.getByText(/\(edited\)/)).toBeDefined();
    expect(screen.queryByText('Removed entry.')).toBeNull();
  });

  it('renders the legacy addendum with its read-only marker', () => {
    render(<AddendumSection notes={[]} legacyText="Old-style addendum text." />);
    expect(screen.getByText('Old-style addendum text.')).toBeDefined();
    expect(screen.getByText('Legacy addendum (read-only)')).toBeDefined();
  });

  it('hasAddendaToShow ignores tombstoned notes and counts legacy text', () => {
    const deleted: NoteDTO = { ...base, deleted: true };
    expect(hasAddendaToShow([deleted])).toBe(false);
    expect(hasAddendaToShow([base])).toBe(true);
    expect(hasAddendaToShow([], 'legacy')).toBe(true);
    expect(hasAddendaToShow([])).toBe(false);
  });
});
