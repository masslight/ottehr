import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import {
  ExamCardsNames,
  ExamFieldsNames,
  ExamObservationDTO,
  InPersonExamCardsNames,
  InPersonExamFieldsNames,
} from 'utils';
import { useFeatureFlags } from '../../features/css-module/context/featureFlags';
import {
  useDeleteChartData,
  useExamObservationsStore as useTelemedExamObservationsStore,
  useInPersonExamObservationsStore,
  useSaveChartData,
} from '../state';

type ExamNames = ExamCardsNames | ExamFieldsNames;
type InPersonExamNames = InPersonExamCardsNames | InPersonExamFieldsNames;
type AllExamNames = ExamNames | InPersonExamNames;
type ExamRecord = { [field in AllExamNames]?: ExamObservationDTO };
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
};

/**
 * Hook to get and update exam observations.
 * @param {AllExamNames} param - Field name.
 * @return {Object} state
 * @return {ExamObservationDTO} state.value - Exam observation with chosen field name.
 * @return {UpdateExamObservations} state.update - Function to update exam observations.
 * @return {boolean} state.isPending - Update query loading status.
 */
export function useExamObservations(param: AllExamNames): {
  value: ExamObservationDTO;
  update: Update;
  delete: Delete;
  isLoading: boolean;
};

/**
 * Hook to get and update exam observations.
 * @param {(AllExamNames)[]} param - Array of field names.
 * @return {Object} state
 * @return {ExamObservationDTO[]} state.value - Exam observations with chosen field names.
 * @return {UpdateExamObservations} state.update - Function to update exam observations.
 * @return {boolean} state.isPending - Update query loading status.
 */
export function useExamObservations(param: AllExamNames[]): {
  value: ExamObservationDTO[];
  update: Update;
  delete: Delete;
  isLoading: boolean;
};

export function useExamObservations(param?: AllExamNames | AllExamNames[]): {
  value: ExamObservationDTO | ExamObservationDTO[];
  update: Update;
  delete: Delete;
  isLoading: boolean;
} {
  const { css } = useFeatureFlags();
  const useExamObservationsStore = css ? useInPersonExamObservationsStore : useTelemedExamObservationsStore;

  const state = useExamObservationsStore() as ReturnType<(typeof useTelemedExamObservationsStore)['getState']>;
  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();

  const getPrevStateAndValues = useCallback(
    (
      param: ExamObservationDTO | ExamObservationDTO[] | ExamRecord
    ): {
      prevState: ReturnType<(typeof useTelemedExamObservationsStore)['getState']> &
        ReturnType<(typeof useInPersonExamObservationsStore)['getState']>;
      prevValues: ExamRecord;
    } => {
      // TODO: fix types

      const prevState = useExamObservationsStore.getState() as ReturnType<
        (typeof useTelemedExamObservationsStore)['getState']
      > &
        ReturnType<(typeof useInPersonExamObservationsStore)['getState']>;

      const prevValues = Array.isArray(param)
        ? param.reduce((prev, curr) => {
            prev[curr.field] = prevState[curr.field as ExamNames & InPersonExamNames];
            // prev[curr.field] = prevState[curr.field];
            return prev;
          }, {} as ExamRecord)
        : Object.prototype.hasOwnProperty.call(param, 'field')
        ? {
            [(param as ExamObservationDTO).field]:
              prevState[(param as ExamObservationDTO).field as ExamNames & InPersonExamNames],
          }
        : (Object.keys(param as ExamRecord) as AllExamNames[]).reduce((prev, curr) => {
            prev[curr] = prevState[curr as ExamNames & InPersonExamNames];
            return prev;
          }, {} as ExamRecord);

      return { prevState, prevValues };
    },
    [useExamObservationsStore]
  );

  const update: Update = (param, noFetch) => {
    if (!param) {
      return;
    }

    const { prevValues } = getPrevStateAndValues(param);

    useExamObservationsStore.setState(
      Array.isArray(param)
        ? arrayToObject(param)
        : Object.prototype.hasOwnProperty.call(param, 'field')
        ? { [(param as ExamObservationDTO).field]: param }
        : (param as ExamRecord)
    );

    if (noFetch) {
      return;
    }

    saveChartData(
      {
        examObservations: Array.isArray(param)
          ? param
          : Object.prototype.hasOwnProperty.call(param, 'field')
          ? [param as ExamObservationDTO]
          : objectToArray(param as ExamRecord),
      },
      {
        onSuccess: (data) => {
          const newState = data.chartData.examObservations?.filter(
            (observation) =>
              !observation.field.endsWith('-comment') ||
              !prevValues[observation.field as ExamNames & InPersonExamNames]?.resourceId
          );
          if (newState) {
            useExamObservationsStore.setState(arrayToObject(newState));
          }
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while saving exam data. Please try again.', { variant: 'error' });
          useExamObservationsStore.setState(prevValues);
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
          delete filteredState[key as ExamNames & InPersonExamNames];
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
        delete filteredState[key as ExamNames & InPersonExamNames];
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
        ? state[param as ExamNames]
        : param.map((option) => state[option as ExamNames])
      : objectToArray(state),
    update,
    delete: deleteExamObservations,
    isLoading: isDeleteLoading || isSaveLoading,
  };
}
