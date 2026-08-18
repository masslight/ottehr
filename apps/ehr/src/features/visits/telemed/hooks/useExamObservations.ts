import { enqueueSnackbar } from 'notistack';
import { useCallback, useRef } from 'react';
import { ExamObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useDeleteChartData, useSaveChartData } from '../../shared/stores/appointment/appointment.store';
import {
  useExamObservationsInitializationStore,
  useExamObservationsStore,
} from '../../shared/stores/appointment/exam-observations.store';
import {
  holdPendingObservationFields,
  trackPendingObservationFields,
  usePendingObservationFields,
} from '../../shared/stores/appointment/pending-observation-fields.store';
import { rollbackObservations } from '../../shared/stores/appointment/rollback-observations';

type ExamRecord = { [field: string]: ExamObservationDTO };
export type Update = (param?: ExamObservationDTO | ExamObservationDTO[] | ExamRecord, noFetch?: boolean) => void;
export type Delete = (param?: ExamObservationDTO | ExamObservationDTO[] | ExamRecord, noFetch?: boolean) => void;

const arrayToObject: (array: ExamObservationDTO[]) => ExamRecord = (array) =>
  array.reduce((prev, curr) => {
    prev[curr.field] = curr;
    return prev;
  }, {} as ExamRecord);

const objectToArray: (object: ExamRecord) => ExamObservationDTO[] = (object) => Object.values(object);

/** Whether an observation holds anything a "Clear Exam" would remove. */
const isSet = (observation: ExamObservationDTO): boolean =>
  observation.value === true || !!observation.note?.trim() || !!observation.components?.length;

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
  // mutateAsync, not mutate: the pending-field bookkeeping has to run off the request promise
  // rather than off react-query's per-call callbacks, which are dropped on unmount.
  const { mutateAsync: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutateAsync: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();
  const { isFieldPending, hasPendingFields } = usePendingObservationFields();
  const hasPendingApiRequestsRef = useRef(false);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const queuedNoteReleaseRef = useRef<() => void>();

  // A write fired by any other component counts too: while a bulk write ("Select all",
  // "Clear Exam") is rewriting these fields, the components rendering them must not accept edits
  // that the bulk response would silently overwrite.
  const hasPendingRequests = param
    ? typeof param === 'string'
      ? isFieldPending(param)
      : param.some(isFieldPending)
    : hasPendingFields;

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

        // The write is only queued, but it is still going to land, so the field reads as busy until
        // it does: a "Clear Exam" fired in this window would delete the note's Observation and then
        // watch the requeued save write it straight back — against the id it has just deleted.
        // The hold replaces the one the timer being cancelled was carrying.
        queuedNoteReleaseRef.current?.();
        queuedNoteReleaseRef.current = holdPendingObservationFields([(options as ExamObservationDTO).field]);

        // delay next update until we have resourceId from the first update
        updateTimeoutRef.current = setTimeout(() => {
          // Released only after the requeued update has taken its own hold, so the field never
          // reads as free in between.
          const release = queuedNoteReleaseRef.current;
          queuedNoteReleaseRef.current = undefined;

          const resourceId = useExamObservationsStore.getState()[(options as ExamObservationDTO).field]?.resourceId;
          update(
            {
              ...options,
              resourceId,
            } as ExamObservationDTO,
            noFetch
          );

          release?.();
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
      useExamObservationsInitializationStore.setState({ hasInitialData: true });
      return;
    }

    const examObservations = Array.isArray(options)
      ? options
      : Object.prototype.hasOwnProperty.call(options, 'field')
      ? [options as ExamObservationDTO]
      : objectToArray(options as ExamRecord);
    const pendingFields = examObservations.map((observation) => observation.field);
    const savedAsSet = new Set(examObservations.filter(isSet).map((observation) => observation.field));

    trackPendingObservationFields(
      pendingFields,
      saveChartData({ examObservations }).then(
        (data) => {
          const returned = data.chartData.examObservations ?? [];
          const currentState = useExamObservationsStore.getState();

          // A "Clear Exam" that landed while this save was in flight could only clear the store
          // copy of these fields: with no resourceId yet, there was nothing to delete. Now that the
          // server has handed us one, delete the resource instead of merging the value back in.
          const clearedMeanwhile = returned.filter((observation) => {
            const current = currentState[observation.field];
            return !!observation.resourceId && savedAsSet.has(observation.field) && !!current && !isSet(current);
          });
          const clearedFields = new Set(clearedMeanwhile.map((observation) => observation.field));

          const newState = returned.filter(
            (observation) =>
              !clearedFields.has(observation.field) &&
              (!observation.field.endsWith('-comment') || !prevValues[observation.field]?.resourceId)
          );

          if (newState.length > 0) {
            useExamObservationsStore.setState(arrayToObject(newState));
          }

          if (clearedMeanwhile.length > 0) {
            trackPendingObservationFields([...clearedFields], deleteChartData({ examObservations: clearedMeanwhile }));
          }

          if (isNoteUpdate) {
            hasPendingApiRequestsRef.current = false;
          }
        },
        () => {
          enqueueSnackbar('An error has occurred while saving exam data. Please try again.', { variant: 'error' });
          rollbackObservations(useExamObservationsStore, prevValues);

          if (isNoteUpdate) {
            hasPendingApiRequestsRef.current = false;
          }
        }
      )
    );
  };

  const deleteExamObservations: Delete = (param, noFetch) => {
    if (!param) {
      return;
    }

    const examObservations = Array.isArray(param)
      ? param
      : Object.prototype.hasOwnProperty.call(param, 'field')
      ? [param as ExamObservationDTO]
      : objectToArray(param as ExamRecord);

    // Every deleted field is left as a blank entry with no resourceId, whether it was deleted one
    // checkbox at a time or in bulk: the Observation is gone, so the next save on that field has to
    // create a new one. Merging the caller's DTOs in verbatim would keep the id of the resource
    // that was just deleted, and re-checking the box would then PUT to a resource the server
    // answers 410 for.
    useExamObservationsStore.setState(
      examObservations.reduce((cleared, observation) => {
        cleared[observation.field] = { field: observation.field, value: false, note: '' };
        return cleared;
      }, {} as ExamRecord)
    );

    if (noFetch) {
      return;
    }

    // Fields whose save never landed have nothing to delete; asking for them would send
    // `/Observation/undefined`.
    const persisted = examObservations.filter((observation) => observation.resourceId);

    if (persisted.length === 0) {
      return;
    }

    trackPendingObservationFields(
      persisted.map((observation) => observation.field),
      deleteChartData({ examObservations: persisted })
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
    isLoading: isDeleteLoading || isSaveLoading || hasPendingRequests,
    hasPendingApiRequests: hasPendingApiRequestsRef.current,
  };
}
