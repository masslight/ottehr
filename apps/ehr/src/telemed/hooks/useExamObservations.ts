import { enqueueSnackbar } from 'notistack';
import {
  ExamCardsNames,
  ExamFieldsNames,
  ExamObservationDTO,
  InPersonExamCardsNames,
  InPersonExamFieldsNames,
} from 'utils';
import {
  useExamObservationsStore as useTelemedExamObservationsStore,
  useInPersonExamObservationsStore,
  useSaveChartData,
} from '../state';
import { useFeatureFlags } from '../../features/css-module/context/featureFlags';

type ExamNames = ExamCardsNames | ExamFieldsNames;
type InPersonExamNames = InPersonExamCardsNames | InPersonExamFieldsNames;
type AllExamNames = ExamNames | InPersonExamNames;
type ExamRecord = { [field in AllExamNames]?: ExamObservationDTO };
type Update = (param?: ExamObservationDTO | ExamObservationDTO[] | ExamRecord, noFetch?: boolean) => void;

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
 * @return {boolean} state.isLoading - Update query loading status.
 */
export function useExamObservations(): {
  value: ExamObservationDTO[];
  update: Update;
  isLoading: boolean;
};

/**
 * Hook to get and update exam observations.
 * @param {AllExamNames} param - Field name.
 * @return {Object} state
 * @return {ExamObservationDTO} state.value - Exam observation with chosen field name.
 * @return {UpdateExamObservations} state.update - Function to update exam observations.
 * @return {boolean} state.isLoading - Update query loading status.
 */
export function useExamObservations(param: AllExamNames): {
  value: ExamObservationDTO;
  update: Update;
  isLoading: boolean;
};

/**
 * Hook to get and update exam observations.
 * @param {(AllExamNames)[]} param - Array of field names.
 * @return {Object} state
 * @return {ExamObservationDTO[]} state.value - Exam observations with chosen field names.
 * @return {UpdateExamObservations} state.update - Function to update exam observations.
 * @return {boolean} state.isLoading - Update query loading status.
 */
export function useExamObservations(param: AllExamNames[]): {
  value: ExamObservationDTO[];
  update: Update;
  isLoading: boolean;
};

export function useExamObservations(param?: AllExamNames | AllExamNames[]): {
  value: ExamObservationDTO | ExamObservationDTO[];
  update: Update;
  isLoading: boolean;
} {
  const { css } = useFeatureFlags();
  const useExamObservationsStore = css ? useInPersonExamObservationsStore : useTelemedExamObservationsStore;

  const state = useExamObservationsStore() as ReturnType<(typeof useTelemedExamObservationsStore)['getState']>;
  const { mutate, isLoading } = useSaveChartData();

  const update: Update = (param, noFetch) => {
    if (!param) {
      return;
    }

    // TODO: fix types
    const prevState = useExamObservationsStore.getState() as ReturnType<
      (typeof useTelemedExamObservationsStore)['getState']
    >;

    const prevValues = Array.isArray(param)
      ? param.reduce((prev, curr) => {
          prev[curr.field] = prevState[curr.field as ExamNames];
          // prev[curr.field] = prevState[curr.field];
          return prev;
        }, {} as ExamRecord)
      : Object.prototype.hasOwnProperty.call(param, 'field')
      ? { [(param as ExamObservationDTO).field]: prevState[(param as ExamObservationDTO).field as ExamNames] }
      : (Object.keys(param as ExamRecord) as AllExamNames[]).reduce((prev, curr) => {
          prev[curr] = prevState[curr as ExamNames];
          return prev;
        }, {} as ExamRecord);

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

    mutate(
      {
        examObservations: Array.isArray(param)
          ? param
          : Object.prototype.hasOwnProperty.call(param, 'field')
          ? [param as ExamObservationDTO]
          : objectToArray(param as ExamRecord),
      },
      {
        onSuccess: (data) => {
          data.chartData.examObservations &&
            useExamObservationsStore.setState(arrayToObject(data.chartData.examObservations));
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while saving exam data. Please try again.', { variant: 'error' });
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
    isLoading,
  };
}
