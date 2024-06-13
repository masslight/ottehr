import { ExamCardsNames, ExamFieldsNames, ExamObservationDTO } from 'ehr-utils';
import { useExamObservationsStore, useSaveChartData } from '../state';

type ExamRecord = { [field in ExamCardsNames | ExamFieldsNames]?: ExamObservationDTO };
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
 * @param {ExamFieldsNames | ExamCardsNames} param - Field name.
 * @return {Object} state
 * @return {ExamObservationDTO} state.value - Exam observation with chosen field name.
 * @return {UpdateExamObservations} state.update - Function to update exam observations.
 * @return {boolean} state.isLoading - Update query loading status.
 */
export function useExamObservations(param: ExamFieldsNames | ExamCardsNames): {
  value: ExamObservationDTO;
  update: Update;
  isLoading: boolean;
};

/**
 * Hook to get and update exam observations.
 * @param {(ExamFieldsNames | ExamCardsNames)[]} param - Array of field names.
 * @return {Object} state
 * @return {ExamObservationDTO[]} state.value - Exam observations with chosen field names.
 * @return {UpdateExamObservations} state.update - Function to update exam observations.
 * @return {boolean} state.isLoading - Update query loading status.
 */
export function useExamObservations(param: (ExamFieldsNames | ExamCardsNames)[]): {
  value: ExamObservationDTO[];
  update: Update;
  isLoading: boolean;
};

export function useExamObservations(param?: ExamFieldsNames | ExamCardsNames | (ExamFieldsNames | ExamCardsNames)[]): {
  value: ExamObservationDTO | ExamObservationDTO[];
  update: Update;
  isLoading: boolean;
} {
  const state = useExamObservationsStore();
  const { mutate, isLoading } = useSaveChartData();

  const update: Update = (param, noFetch) => {
    if (!param) {
      return;
    }

    useExamObservationsStore.setState(
      Array.isArray(param)
        ? arrayToObject(param)
        : Object.prototype.hasOwnProperty.call(param, 'field')
          ? { [(param as ExamObservationDTO).field]: param }
          : (param as ExamRecord),
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
          data.examObservations && useExamObservationsStore.setState(arrayToObject(data.examObservations));
        },
      },
    );
  };

  return {
    value: param
      ? typeof param === 'string'
        ? state[param]
        : param.map((option) => state[option])
      : objectToArray(state),
    update,
    isLoading,
  };
}
