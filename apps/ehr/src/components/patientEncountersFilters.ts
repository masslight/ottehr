import { AppointmentHistoryRow } from 'utils/lib/types/api/patient-visit-history.types';

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
