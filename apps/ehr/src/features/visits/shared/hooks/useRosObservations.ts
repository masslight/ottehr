import { enqueueSnackbar } from 'notistack';
import { useCallback, useRef } from 'react';
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

  // Serialize saves so that rapid clicks never run two concurrent saveChartData
  // calls on the same mutation instance. React Query only fires onSuccess/onError
  // callbacks for the *last* mutate call, so a second call before the first
  // returns would silently drop the first callback (and the paired delete inside it).
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const update = useCallback(
    (observations: ExamObservationDTO[], noFetch?: boolean) => {
      const prevState = useRosObservationsStore.getState();

      // Rollback snapshot
      const prevValues = observations.reduce((acc, obs) => {
        acc[obs.field] = prevState[obs.field];
        return acc;
      }, {} as RosRecord);

      // Optimistic update
      useRosObservationsStore.setState(arrayToObject(observations));

      if (noFetch) {
        useRosObservationsInitializationStore.setState({ hasInitialData: true });
        return;
      }

      const toSave = observations.filter((o) => o.value === true);
      const toDelete = observations.filter((o) => !o.value && o.resourceId);

      if (toSave.length > 0) {
        saveQueue.current = saveQueue.current.then(
          () =>
            new Promise<void>((resolve) => {
              saveChartData(
                { rosObservations: toSave },
                {
                  onSuccess: (data) => {
                    const returned = data.chartData.rosObservations ?? [];
                    const currentState = useRosObservationsStore.getState();

                    // Merge server truth for fields still active in the UI
                    const stillActive = returned.filter((obs) => currentState[obs.field]?.value === true);
                    if (stillActive.length > 0) {
                      useRosObservationsStore.setState(arrayToObject(stillActive));
                    }

                    // Sequence all deletes after the save to prevent FHIR races.
                    // fromFlip catches fields toggled to false while the save was in-flight:
                    // their resourceId was unknown at click time but the server just returned it.
                    const fromFlip = returned.filter(
                      (obs) => currentState[obs.field]?.value !== true && obs.resourceId
                    );
                    const allToDelete = [
                      ...toDelete,
                      ...fromFlip.filter((f) => !toDelete.some((d) => d.field === f.field)),
                    ];
                    if (allToDelete.length > 0) {
                      deleteChartData({ rosObservations: allToDelete });
                    }

                    resolve();
                  },
                  onError: () => {
                    enqueueSnackbar('An error occurred while saving ROS data. Please try again.', { variant: 'error' });
                    useRosObservationsStore.setState(prevValues);
                    resolve();
                  },
                }
              );
            })
        );
      } else if (toDelete.length > 0) {
        // No save in this batch — safe to delete immediately (no in-flight save for these fields)
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
