import { EASY_CHART_VISIT_LOCKED_MESSAGE } from 'utils/lib/easy-chart/access';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';

/** Shown on every Autochart control that is turned off because the chart is locked. */
export const AUTOCHART_LOCKED_TOOLTIP = 'The chart is signed and locked, so AutoChart can’t change it.';

/** The message the client-side save mutation throws for a read-only visit (`useSaveChartData`). */
const READ_ONLY_SAVE_MESSAGE = 'update disabled in read only mode';

/** True for an error that means the visit is locked, from an Easy Chart endpoint or from the save mutation. */
export const isVisitLockedError = (error: unknown): boolean => {
  const message = getApiError({ error, defaultError: '' });
  return message === EASY_CHART_VISIT_LOCKED_MESSAGE || message === READ_ONLY_SAVE_MESSAGE;
};

/**
 * Whether Autochart must stay read-only: the visit is read-only as loaded (the EHR's own rule), or a write
 * endpoint has since answered that it is locked.
 */
export const useAutochartLock = (): { locked: boolean } => {
  const { isAppointmentReadOnly } = useGetAppointmentAccessibility();
  const lockedByServer = useScribeRecommendationsStore((state) => state.visitLockedByServer);
  return { locked: isAppointmentReadOnly || lockedByServer };
};
