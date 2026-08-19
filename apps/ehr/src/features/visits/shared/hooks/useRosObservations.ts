import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import { ExamObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useDeleteChartData, useSaveChartData } from '../stores/appointment/appointment.store';
import {
  trackPendingObservationFields,
  usePendingObservationFields,
} from '../stores/appointment/pending-observation-fields.store';
import { rollbackObservations } from '../stores/appointment/rollback-observations';
import {
  useRosObservationsInitializationStore,
  useRosObservationsStore,
} from '../stores/appointment/ros-observations.store';

type RosRecord = Record<string, ExamObservationDTO>;

const arrayToObject = (array: ExamObservationDTO[]): RosRecord =>
  array.reduce((prev, curr) => {
    prev[curr.field] = curr;
    return prev;
  }, {} as RosRecord);

export function useRosObservations(): {
  update: (observations: ExamObservationDTO[], noFetch?: boolean) => void;
  isLoading: boolean;
  /**
   * Whether any component has a save or delete in flight for `field`. The rows read every
   * observation rather than a single field, so they need to ask per checkbox.
   */
  isFieldPending: (field: string) => boolean;
  /** Every observation keyed by field, which is how the rows look theirs up. */
  observationMap: Record<string, ExamObservationDTO>;
} {
  const state = useRosObservationsStore();
  // mutateAsync, not mutate: the pending-field bookkeeping has to run off the request promise
  // rather than off react-query's per-call callbacks, which are dropped on unmount and whenever a
  // second mutation is fired from the same hook instance — as the corrective delete below does.
  const { mutateAsync: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutateAsync: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();
  const { isFieldPending } = usePendingObservationFields();

  const update = useCallback(
    (observations: ExamObservationDTO[], noFetch?: boolean) => {
      // Capture previous values for the fields being changed (for rollback)
      const prevState = useRosObservationsStore.getState();
      const prevValues = observations.reduce((acc, obs) => {
        acc[obs.field] = prevState[obs.field];
        return acc;
      }, {} as RosRecord);

      const toSave = observations.filter((o) => o.value === true);
      const toDelete = noFetch ? [] : observations.filter((o) => !o.value && o.resourceId);
      const deletedFields = new Set(toDelete.map((o) => o.field));

      // Merge into store (same pattern as useExamObservations). Fields being deleted are stored
      // without their resourceId: the Observation is about to be gone, so re-checking the box has to
      // create a new one rather than PUT the id that was just deleted — which a "Clear ROS" or a
      // "Select all" turned off would otherwise do for a whole system at a time.
      useRosObservationsStore.setState(
        arrayToObject(
          observations.map((o) => (deletedFields.has(o.field) ? { field: o.field, label: o.label, value: false } : o))
        )
      );

      if (noFetch) {
        useRosObservationsInitializationStore.setState({ hasInitialData: true });
        return;
      }

      if (toSave.length > 0) {
        const pendingFields = toSave.map((o) => o.field);

        trackPendingObservationFields(
          pendingFields,
          saveChartData({ rosObservations: toSave }).then(
            (data) => {
              if (data.chartData.rosObservations) {
                const returned = data.chartData.rosObservations;
                // If the user toggled back to false while the save was in-flight, the
                // resourceId was unknown at uncheck time so no delete was sent. Now that
                // we have the resourceId from the server, send the delete and skip the
                // overwrite; otherwise merge the server response (with resourceIds).
                const currentState = useRosObservationsStore.getState();
                const stillTrue = returned.filter((obs) => currentState[obs.field]?.value === true);
                const needsDelete = returned.filter((obs) => currentState[obs.field]?.value !== true && obs.resourceId);

                if (stillTrue.length > 0) {
                  useRosObservationsStore.setState(arrayToObject(stillTrue));
                }
                if (needsDelete.length > 0) {
                  trackPendingObservationFields(
                    needsDelete.map((obs) => obs.field),
                    deleteChartData({ rosObservations: needsDelete })
                  );
                }
              }
            },
            () => {
              enqueueSnackbar('An error occurred while saving ROS data. Please try again.', { variant: 'error' });
              // Restore only the fields this write changed, leaving the rest of the store alone
              rollbackObservations(useRosObservationsStore, prevValues);
            }
          )
        );
      }

      if (toDelete.length > 0) {
        trackPendingObservationFields(
          toDelete.map((o) => o.field),
          deleteChartData({ rosObservations: toDelete })
        );
      }
    },
    [saveChartData, deleteChartData]
  );

  return {
    update,
    isLoading: isDeleteLoading || isSaveLoading,
    isFieldPending,
    observationMap: state,
  };
}
