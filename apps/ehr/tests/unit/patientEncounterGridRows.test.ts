import { DateTime } from 'luxon';
import { AppointmentHistoryRow, FreeFormEncounterHistoryRow } from 'utils/lib/types/api/patient-visit-history.types';
import { describe, expect, it } from 'vitest';
import {
  applyLocalFreeFormSaves,
  freeFormRowsStartingFrom,
  mergeEncounterGridRows,
  pruneCaughtUpLocalSaves,
} from '../../src/components/patientEncountersFilters';

const visit = (id: string, dateTime?: string): AppointmentHistoryRow =>
  ({ appointmentId: id, dateTime }) as AppointmentHistoryRow;

const note = (
  id: string,
  dateTime: string | undefined,
  overrides: Partial<FreeFormEncounterHistoryRow> = {}
): FreeFormEncounterHistoryRow => ({
  encounterId: id,
  dateTime,
  note: `note ${id}`,
  lastUpdated: '2026-09-15T15:00:00.000Z',
  ...overrides,
});

const ids = (rows: { id: string }[]): string[] => rows.map((row) => row.id);

describe('mergeEncounterGridRows', () => {
  const visits = [
    visit('visit-sep-10', '2026-09-10T10:00:00-04:00'),
    visit('visit-sep-20', '2026-09-20T10:00:00-04:00'),
  ];
  const notes = [note('note-sep-15', '2026-09-15T14:00:00.000Z')];

  it('interleaves visits and free-form notes by date, newest first', () => {
    expect(ids(mergeEncounterGridRows(visits, notes, { includeFreeForm: true, sortDirection: 'desc' }))).toEqual([
      'visit-sep-20',
      'note-sep-15',
      'visit-sep-10',
    ]);
  });

  it('sorts oldest first when ascending', () => {
    expect(ids(mergeEncounterGridRows(visits, notes, { includeFreeForm: true, sortDirection: 'asc' }))).toEqual([
      'visit-sep-10',
      'note-sep-15',
      'visit-sep-20',
    ]);
  });

  it('compares instants across time zones', () => {
    const sameDay = [visit('visit-noon-et', '2026-09-15T12:00:00-04:00')];
    const earlierUtc = [note('note-15-utc', '2026-09-15T15:00:00.000Z')];
    expect(ids(mergeEncounterGridRows(sameDay, earlierUtc, { includeFreeForm: true, sortDirection: 'desc' }))).toEqual([
      'visit-noon-et',
      'note-15-utc',
    ]);
  });

  it('orders identical timestamps by id in both directions', () => {
    const at = '2026-09-15T14:00:00.000Z';
    const tied = [note('b-note', at), note('a-note', at)];
    const tiedVisits = [visit('c-visit', at)];
    for (const sortDirection of ['asc', 'desc'] as const) {
      expect(ids(mergeEncounterGridRows(tiedVisits, tied, { includeFreeForm: true, sortDirection }))).toEqual([
        'a-note',
        'b-note',
        'c-visit',
      ]);
    }
  });

  it('puts missing and invalid timestamps last in both directions', () => {
    const rows = [note('missing', undefined), note('invalid', 'not-a-date'), note('dated', '2026-09-15T14:00:00.000Z')];
    for (const sortDirection of ['asc', 'desc'] as const) {
      expect(ids(mergeEncounterGridRows([], rows, { includeFreeForm: true, sortDirection }))).toEqual([
        'dated',
        'invalid',
        'missing',
      ]);
    }
  });

  it('drops free-form notes when they are excluded', () => {
    expect(ids(mergeEncounterGridRows(visits, notes, { includeFreeForm: false, sortDirection: 'desc' }))).toEqual([
      'visit-sep-20',
      'visit-sep-10',
    ]);
  });
});

describe('freeFormRowsStartingFrom', () => {
  const rows = [
    note('recent', '2026-10-20T12:00:00.000Z'),
    note('old', '2025-01-15T12:00:00.000Z'),
    note('missing', undefined),
    note('invalid', 'not-a-date'),
  ];

  it('keeps every row when there is no period', () => {
    expect(freeFormRowsStartingFrom(rows, undefined)).toBe(rows);
  });

  it('keeps only rows that start within the period, dropping ones without a valid start', () => {
    const from = DateTime.fromISO('2026-09-26T00:00:00.000Z');
    expect(freeFormRowsStartingFrom(rows, from).map((row) => row.encounterId)).toEqual(['recent']);
  });
});

describe('applyLocalFreeFormSaves', () => {
  const server = note('n1', '2026-09-15T14:00:00.000Z', {
    note: 'server text',
    lastUpdated: '2026-09-15T15:00:00.000Z',
  });

  it('adds a local row the server has not returned yet', () => {
    const local = note('n2', '2026-09-16T14:00:00.000Z');
    expect(applyLocalFreeFormSaves([server], [local])).toEqual([server, local]);
  });

  it('keeps the local row over a stale server row', () => {
    const local = { ...server, note: 'saved text', lastUpdated: '2026-09-15T15:05:00.000Z' };
    expect(applyLocalFreeFormSaves([server], [local])).toEqual([local]);
  });

  it('uses the server row once it has caught up or holds a newer write', () => {
    const local = { ...server, note: 'saved text', lastUpdated: '2026-09-15T15:00:00.000Z' };
    expect(applyLocalFreeFormSaves([server], [local])).toEqual([server]);
    const newer = { ...server, note: 'someone else', lastUpdated: '2026-09-15T16:00:00.000Z' };
    expect(applyLocalFreeFormSaves([newer], [local])).toEqual([newer]);
  });

  it('treats a server row without lastUpdated as stale', () => {
    const local = { ...server, note: 'saved text' };
    expect(applyLocalFreeFormSaves([{ ...server, lastUpdated: undefined }], [local])).toEqual([local]);
  });
});

describe('pruneCaughtUpLocalSaves', () => {
  const local = note('n1', '2026-09-15T14:00:00.000Z', { lastUpdated: '2026-09-15T15:05:00.000Z' });

  it('keeps entries the server has not caught up with, by reference when nothing changes', () => {
    const rows = { n1: local };
    expect(pruneCaughtUpLocalSaves([], rows)).toBe(rows);
    expect(pruneCaughtUpLocalSaves([{ ...local, lastUpdated: '2026-09-15T15:00:00.000Z' }], rows)).toBe(rows);
  });

  it('drops entries the server has caught up with', () => {
    expect(pruneCaughtUpLocalSaves([local], { n1: local })).toEqual({});
  });
});
