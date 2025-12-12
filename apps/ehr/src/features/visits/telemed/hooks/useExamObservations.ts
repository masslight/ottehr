import { enqueueSnackbar } from 'notistack';
import { useCallback, useRef } from 'react';
import { ExamObservationDTO } from 'utils';
import { useDeleteChartData, useSaveChartData } from '../../shared/stores/appointment/appointment.store';
import { useExamObservationsStore } from '../../shared/stores/appointment/exam-observations.store';

type ExamRecord = { [field: string]: ExamObservationDTO };
type Update = (param?: ExamObservationDTO | ExamObservationDTO[] | ExamRecord, noFetch?: boolean) => void;
type Delete = (param?: ExamObservationDTO | ExamObservationDTO[] | ExamRecord, noFetch?: boolean) => void;

const arrayToObject: (array: ExamObservationDTO[]) => ExamRecord = (array) =>
  array.reduce((prev, curr) => {
    prev[curr.field] = curr;
    return prev;
  }, {} as ExamRecord);

const objectToArray: (object: ExamRecord) => ExamObservationDTO[] = (object) => Object.values(object);

/**
 * @typedef {Function} UpdateExamObservations
 * @param {ExamObservationDTO} param - Exam observation object.
 * @param {ExamObservationDTO[]} param - Array of exam observation objects.
 * @param {ExamRecord} param - Record of exam observation objects.
 * @param {boolean} noFetch - Flag not to update server values.
 */

/**
 * Hook to get and update exam observations.
 * @return {Object} state
 * @return {ExamObservationDTO} state.value - All exam observations.
 * @return {UpdateExamObservations} state.update - Function to update exam observations.
 * @return {boolean} state.isPending - Update query loading status.
 */
export function useExamObservations(): {
  value: ExamObservationDTO[];
  update: Update;
  delete: Delete;
  isLoading: boolean;
  hasPendingApiRequests: boolean;
};

/**
 * Hook to get and update exam observations.
 * @param {AllExamNames} param - Field name.
 * @return {Object} state
 * @return {ExamObservationDTO} state.value - Exam observation with chosen field name.
 * @return {UpdateExamObservations} state.update - Function to update exam observations.
 * @return {boolean} state.isPending - Update query loading status.
 */
export function useExamObservations(param: string): {
  value: ExamObservationDTO;
  update: Update;
  delete: Delete;
  isLoading: boolean;
  hasPendingApiRequests: boolean;
};

/**
 * Hook to get and update exam observations.
 * @param {(AllExamNames)[]} param - Array of field names.
 * @return {Object} state
 * @return {ExamObservationDTO[]} state.value - Exam observations with chosen field names.
 * @return {UpdateExamObservations} state.update - Function to update exam observations.
 * @return {boolean} state.isPending - Update query loading status.
 */
export function useExamObservations(param: string[]): {
  value: ExamObservationDTO[];
  update: Update;
  delete: Delete;
  isLoading: boolean;
  hasPendingApiRequests: boolean;
};

export function useExamObservations(param?: string | string[]): {
  value: ExamObservationDTO | ExamObservationDTO[];
  update: Update;
  delete: Delete;
  isLoading: boolean;
  hasPendingApiRequests: boolean; // we can use it later to prevent navigation if there are pending api requests
} {
  const state = useExamObservationsStore();
  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();
  const hasPendingApiRequestsRef = useRef(false);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const getPrevStateAndValues = useCallback(
    (
      param: ExamObservationDTO | ExamObservationDTO[] | ExamRecord
    ): {
      prevState: ReturnType<typeof useExamObservationsStore.getState>;
      prevValues: ExamRecord;
    } => {
      const prevState = useExamObservationsStore.getState();

      const prevValues = Array.isArray(param)
        ? param.reduce((prev, curr) => {
            prev[curr.field] = prevState[curr.field];
            return prev;
          }, {} as ExamRecord)
        : Object.prototype.hasOwnProperty.call(param, 'field')
        ? {
            [(param as ExamObservationDTO).field]: prevState[(param as ExamObservationDTO).field],
          }
        : (Object.keys(param as ExamRecord) as string[]).reduce((prev, curr) => {
            prev[curr] = prevState[curr];
            return prev;
          }, {} as ExamRecord);

      return { prevState, prevValues };
    },
    []
  );

  const update: Update = (options, noFetch) => {
    if (!options) {
      return;
    }

    // used to fix creation of duplicates for note fields, caused by debounced calls without resourceId
    const isNoteUpdate = Object.prototype.hasOwnProperty.call(options, 'note');

    if (isNoteUpdate) {
      const shouldAwaitResourceId =
        !(options as ExamObservationDTO).resourceId &&
        useExamObservationsStore.getState()[(options as ExamObservationDTO).field]?.resourceId;

      if (hasPendingApiRequestsRef.current || shouldAwaitResourceId) {
        clearTimeout(updateTimeoutRef.current);

        // delay next update until we have resourceId from the first update
        updateTimeoutRef.current = setTimeout(() => {
          const resourceId = useExamObservationsStore.getState()[(options as ExamObservationDTO).field]?.resourceId;
          update(
            {
              ...options,
              resourceId,
            } as ExamObservationDTO,
            noFetch
          );
        }, 1000);

        return;
      }

      hasPendingApiRequestsRef.current = true;
    }

    const { prevValues } = getPrevStateAndValues(options);

    useExamObservationsStore.setState(
      Array.isArray(options)
        ? arrayToObject(options)
        : Object.prototype.hasOwnProperty.call(options, 'field')
        ? { [(options as ExamObservationDTO).field]: options as ExamObservationDTO }
        : (options as ExamRecord)
    );

    if (noFetch) {
      return;
    }

    saveChartData(
      {
        examObservations: Array.isArray(options)
          ? options
          : Object.prototype.hasOwnProperty.call(options, 'field')
          ? [options as ExamObservationDTO]
          : objectToArray(options as ExamRecord),
      },
      {
        onSuccess: (data) => {
          const newState = data.chartData.examObservations?.filter(
            (observation) => !observation.field.endsWith('-comment') || !prevValues[observation.field]?.resourceId
          );

          if (newState) {
            useExamObservationsStore.setState(arrayToObject(newState));
          }

          if (isNoteUpdate) {
            hasPendingApiRequestsRef.current = false;
          }
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while saving exam data. Please try again.', { variant: 'error' });
          useExamObservationsStore.setState(prevValues);

          if (isNoteUpdate) {
            hasPendingApiRequestsRef.current = false;
          }
        },
      }
    );
  };

  const deleteExamObservations: Delete = (param, noFetch) => {
    if (!param) {
      return;
    }

    const { prevState, prevValues } = getPrevStateAndValues(param);

    useExamObservationsStore.setState(() => {
      // If param is an array, convert to object
      if (Array.isArray(param)) {
        const newObject = arrayToObject(param);
        // Remove fields from prevState that are in newObject
        const filteredState = { ...prevState };
        Object.keys(newObject).forEach((key) => {
          delete filteredState[key];
        });
        return { ...filteredState, ...newObject };
      }

      // If param is a single observation
      if (Object.prototype.hasOwnProperty.call(param, 'field')) {
        const field = (param as ExamObservationDTO).field;
        // Create a new state without the field
        const { [field]: _removed, ...rest } = prevState;

        return { [field]: { field: _removed.field, note: '' }, ...rest };
      }

      // If param is an ExamRecord
      const examRecord = param as ExamRecord;
      // Remove all fields from prevState that are in examRecord
      const filteredState = { ...prevState };
      Object.keys(examRecord).forEach((key) => {
        delete filteredState[key];
      });
      return { ...filteredState, ...examRecord };
    });

    if (noFetch) {
      return;
    }

    deleteChartData(
      {
        examObservations: Array.isArray(param)
          ? param
          : Object.prototype.hasOwnProperty.call(param, 'field')
          ? [param as ExamObservationDTO]
          : objectToArray(param as ExamRecord),
      },
      {
        onError: () => {
          useExamObservationsStore.setState(prevValues);
        },
      }
    );
  };

  return {
    value: param
      ? typeof param === 'string'
        ? state[param] ?? { field: param, value: false, note: '' }
        : param.map((option) => state[option] ?? { field: option, value: false, note: '' })
      : objectToArray(state),
    update,
    delete: deleteExamObservations,
    isLoading: isDeleteLoading || isSaveLoading,
    hasPendingApiRequests: hasPendingApiRequestsRef.current,
  };
}
