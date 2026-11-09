import { AppointmentHistoryRow, FreeFormEncounterHistoryRow } from 'utils/lib/types/api/patient-visit-history.types';
import { compareDates } from 'utils/lib/utils/dateUtils';

/**
 * Apply the Encounters table's Service Category filter to the visit list.
 *
 * A follow-up carries its own service category — a UC visit can have an OM
 * follow-up — but follow-up rows only render indented beneath their parent
 * visit, so they can't be shown on their own. A parent is therefore kept when
 * its own category matches OR it still has a matching follow-up to display (it
 * stays as the context row for that follow-up), and non-matching follow-ups are
 * pruned from the rows that are kept.
 *
 * Filtering the parents alone would contradict what the table renders: picking
 * OM would drop an OM follow-up whose parent is UC, and picking UC would list
 * an OM follow-up inside a UC-only result set.
 */
export const filterVisitsByServiceCategory = (
  visits: AppointmentHistoryRow[],
  serviceCategory: string
): AppointmentHistoryRow[] =>
  visits.flatMap((visit) => {
    const followUps = (visit.followUps ?? []).filter((followUp) => followUp.serviceCategory === serviceCategory);
    const keep = visit.serviceCategory === serviceCategory || followUps.length > 0;
    return keep ? [{ ...visit, followUps }] : [];
  });

export type EncounterGridSortDirection = 'asc' | 'desc';

export type EncounterGridRow =
  | { kind: 'visit'; id: string; dateTime: string | undefined; visit: AppointmentHistoryRow }
  | { kind: 'free-form'; id: string; dateTime: string | undefined; encounter: FreeFormEncounterHistoryRow };

export const compareEncounterGridRows = (
  a: EncounterGridRow,
  b: EncounterGridRow,
  direction: EncounterGridSortDirection
): number =>
  (direction === 'desc' ? compareDates(a.dateTime, b.dateTime) : compareDates(b.dateTime, a.dateTime)) ||
  a.id.localeCompare(b.id);

export const mergeEncounterGridRows = (
  visits: AppointmentHistoryRow[],
  freeFormEncounters: FreeFormEncounterHistoryRow[],
  { includeFreeForm, sortDirection }: { includeFreeForm: boolean; sortDirection: EncounterGridSortDirection }
): EncounterGridRow[] =>
  [
    ...visits.map(
      (visit): EncounterGridRow => ({ kind: 'visit', id: visit.appointmentId, dateTime: visit.dateTime, visit })
    ),
    ...(includeFreeForm
      ? freeFormEncounters.map(
          (encounter): EncounterGridRow => ({
            kind: 'free-form',
            id: encounter.encounterId,
            dateTime: encounter.dateTime,
            encounter,
          })
        )
      : []),
  ].sort((a, b) => compareEncounterGridRows(a, b, sortDirection));

const isOlderThan = (candidate: string | undefined, reference: string | undefined): boolean =>
  compareDates(candidate, reference) > 0;

export const freeFormRowsStartingFrom = (
  rows: FreeFormEncounterHistoryRow[],
  from: string | undefined
): FreeFormEncounterHistoryRow[] => {
  if (!from) return rows;
  return rows.filter((row) => compareDates(row.dateTime, from) <= 0);
};

export const applyLocalFreeFormSaves = (
  serverRows: FreeFormEncounterHistoryRow[],
  localRows: FreeFormEncounterHistoryRow[]
): FreeFormEncounterHistoryRow[] => {
  const localById = new Map(localRows.map((row) => [row.encounterId, row]));
  const merged = serverRows.map((serverRow) => {
    const localRow = localById.get(serverRow.encounterId);
    return localRow && isOlderThan(serverRow.lastUpdated, localRow.lastUpdated) ? localRow : serverRow;
  });
  const serverIds = new Set(serverRows.map((row) => row.encounterId));
  return [...merged, ...localRows.filter((row) => !serverIds.has(row.encounterId))];
};

export const pruneCaughtUpLocalSaves = (
  serverRows: FreeFormEncounterHistoryRow[],
  localRows: Record<string, FreeFormEncounterHistoryRow>
): Record<string, FreeFormEncounterHistoryRow> => {
  const serverById = new Map(serverRows.map((row) => [row.encounterId, row]));
  const remaining = Object.entries(localRows).filter(([encounterId, localRow]) => {
    const serverRow = serverById.get(encounterId);
    return !serverRow || isOlderThan(serverRow.lastUpdated, localRow.lastUpdated);
  });
  return remaining.length === Object.keys(localRows).length ? localRows : Object.fromEntries(remaining);
};
