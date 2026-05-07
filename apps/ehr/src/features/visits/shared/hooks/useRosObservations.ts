import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import { ExamObservationDTO } from 'utils';
import { useDeleteChartData, useSaveChartData } from '../stores/appointment/appointment.store';
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

const objectToArray = (object: RosRecord): ExamObservationDTO[] => Object.values(object);

export function useRosObservations(): {
  value: ExamObservationDTO[];
  update: (observations: ExamObservationDTO[], noFetch?: boolean) => void;
  isLoading: boolean;
};

export function useRosObservations(field: string): {
  value: ExamObservationDTO;
  update: (observations: ExamObservationDTO[], noFetch?: boolean) => void;
  isLoading: boolean;
};

export function useRosObservations(field?: string): {
  value: ExamObservationDTO | ExamObservationDTO[];
  update: (observations: ExamObservationDTO[], noFetch?: boolean) => void;
  isLoading: boolean;
} {
  const state = useRosObservationsStore();
  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();

  const update = useCallback(
    (observations: ExamObservationDTO[], noFetch?: boolean) => {
      // Capture previous values for the fields being changed (for rollback)
      const prevState = useRosObservationsStore.getState();
      const prevValues = observations.reduce((acc, obs) => {
        acc[obs.field] = prevState[obs.field];
        return acc;
      }, {} as RosRecord);

      // Merge into store (same pattern as useExamObservations)
      useRosObservationsStore.setState(arrayToObject(observations));

      if (noFetch) {
        useRosObservationsInitializationStore.setState({ hasInitialData: true });
        return;
      }

      const toSave = observations.filter((o) => o.value === true);
      const toDelete = observations.filter((o) => !o.value && o.resourceId);

      if (toSave.length > 0) {
        saveChartData(
          { rosObservations: toSave },
          {
            onSuccess: (data) => {
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
                  deleteChartData({ rosObservations: needsDelete });
                }
              }
            },
            onError: () => {
              enqueueSnackbar('An error occurred while saving ROS data. Please try again.', { variant: 'error' });
              // Restore only the changed fields (merge, not replace)
              useRosObservationsStore.setState(prevValues);
            },
          }
        );
      }

      if (toDelete.length > 0) {
        deleteChartData({ rosObservations: toDelete });
      }
    },
    [saveChartData, deleteChartData]
  );

  return {
    value: field ? state[field] ?? { field, value: false } : objectToArray(state),
    update,
    isLoading: isDeleteLoading || isSaveLoading,
  };
}
