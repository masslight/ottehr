import { ExamObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { StoreApi } from 'zustand';

/**
 * Restores the pre-request values of the fields a failed write had optimistically changed.
 *
 * Fields that had no entry at all are dropped rather than written back as `undefined`: the
 * observation stores are read as dense records, so an `undefined` entry blows up the first
 * consumer that reaches for `observation.field`.
 */
export const rollbackObservations = (
  store: StoreApi<Record<string, ExamObservationDTO>>,
  prevValues: Record<string, ExamObservationDTO | undefined>
): void =>
  store.setState((state) => {
    const restored = { ...state };

    Object.entries(prevValues).forEach(([field, previous]) => {
      if (previous) {
        restored[field] = previous;
      } else {
        delete restored[field];
      }
    });

    return restored;
  }, true);
