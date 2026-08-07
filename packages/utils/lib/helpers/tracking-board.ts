import { DateTime } from 'luxon';
import { VisitStatusLabel } from '../types';

const IN_PERSON_VISIT_TYPES = ['in-person-walk-in', 'in-person-pre-booked', 'in-person-post-telemed'].join(',');

const getTrackingBoardTab = (visitStatus?: VisitStatusLabel): 'prebooked' | 'in-office' | 'completed' | 'cancelled' => {
  // Mirrors how get-appointments buckets each status into a tab. 'pending' is the only prebooked
  // status; 'awaiting supervisor approval' is a finished encounter and lives in the completed tab.
  if (visitStatus === 'pending') {
    return 'prebooked';
  }

  if (visitStatus === 'completed' || visitStatus === 'discharged' || visitStatus === 'awaiting supervisor approval') {
    return 'completed';
  }

  if (visitStatus === 'cancelled' || visitStatus === 'no show') {
    return 'cancelled';
  }

  return 'in-office';
};

/**
 * Builds the tracking-board (/visits) path that shows the given in-person visit: filtered to its
 * location, dated to its appointment day, and opened on the tab its status buckets into. Pure
 * (URLSearchParams + luxon), shared by the Complete Encounters report UI and the ad-hoc reporting
 * zambdas.
 */
export const buildTrackingBoardPath = ({
  appointmentStart,
  locationId,
  visitStatus,
}: {
  appointmentStart?: string;
  locationId: string;
  visitStatus?: VisitStatusLabel;
}): string => {
  const parsedStart = appointmentStart ? DateTime.fromISO(appointmentStart) : undefined;
  const searchDate = (parsedStart?.isValid ? parsedStart : DateTime.now()).toFormat('yyyy-MM-dd');

  const searchParams = new URLSearchParams({
    location: locationId,
    visitType: IN_PERSON_VISIT_TYPES,
    dateFrom: searchDate,
    dateTo: searchDate,
    tab: getTrackingBoardTab(visitStatus),
  });

  return `/visits?${searchParams.toString()}`;
};
