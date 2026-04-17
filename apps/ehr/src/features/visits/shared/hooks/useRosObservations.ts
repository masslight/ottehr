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
      const prevState = useRosObservationsStore.getState();

      // Apply to store
      useRosObservationsStore.setState(arrayToObject(observations));

      if (noFetch) {
        useRosObservationsInitializationStore.setState({ hasInitialData: true });
        return;
      }

      // Separate saves and deletes: value=true or has resourceId → save, value=false without resourceId → skip
      const toSave = observations.filter((o) => o.value || o.resourceId);
      const toDelete = observations.filter((o) => !o.value && o.resourceId);

      if (toSave.length > 0) {
        saveChartData(
          { rosObservations: toSave },
          {
            onSuccess: (data) => {
              if (data.chartData.rosObservations) {
                useRosObservationsStore.setState(arrayToObject(data.chartData.rosObservations));
              }
            },
            onError: () => {
              enqueueSnackbar('An error occurred while saving ROS data. Please try again.', { variant: 'error' });
              useRosObservationsStore.setState(prevState);
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
