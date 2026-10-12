import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import { isRosObservationSet, ROS_COMMENT_FIELD_KEYS } from 'utils/lib/ottehr-config/review-of-systems';
import { ExamObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useDeleteChartData, useSaveChartData } from '../stores/appointment/appointment.store';
import {
  holdPendingObservationFields,
  trackPendingObservationFields,
  usePendingObservationFields,
  usePendingObservationFieldsStore,
} from '../stores/appointment/pending-observation-fields.store';
import { rollbackObservations } from '../stores/appointment/rollback-observations';
import {
  getRosStoreGeneration,
  useRosObservationsInitializationStore,
  useRosObservationsStore,
} from '../stores/appointment/ros-observations.store';

type RosRecord = Record<string, ExamObservationDTO>;

const arrayToObject = (array: ExamObservationDTO[]): RosRecord =>
  array.reduce((prev, curr) => {
    prev[curr.field] = curr;
    return prev;
  }, {} as RosRecord);

const COMMENT_FIELDS = new Set(ROS_COMMENT_FIELD_KEYS);

// Per-field comment bookkeeping, valid for one store generation: writes are chained so a save never goes out
// before the previous one returns its resourceId, and `committed` is what the server holds (the rollback target).
let commentStateGeneration = getRosStoreGeneration();
const commentWrites = new Map<string, { seq: number; chain: Promise<void> }>();
const committedComments = new Map<string, ExamObservationDTO | undefined>();

const syncCommentState = (): void => {
  if (commentStateGeneration === getRosStoreGeneration()) return;
  commentStateGeneration = getRosStoreGeneration();
  commentWrites.clear();
  committedComments.clear();
};

const restoreComment = (field: string, entry: ExamObservationDTO | undefined): void =>
  rollbackObservations(useRosObservationsStore, { [field]: entry });

export function useRosObservations(): {
  update: (observations: ExamObservationDTO[], noFetch?: boolean) => void;
  /** `generation` is the store generation the edit was made in; a stale edit is dropped. */
  updateComment: (field: string, label: string, note: string, generation?: number) => void;
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

  /** Resolves to whether every request succeeded. */
  const write = useCallback(
    (observations: ExamObservationDTO[], noFetch?: boolean): Promise<boolean> => {
      syncCommentState();
      const generation = getRosStoreGeneration();

      if (noFetch) {
        // A server copy must not overwrite a comment that is being edited or saved.
        const { counts } = usePendingObservationFieldsStore.getState();
        const incoming = observations.filter((o) => !(COMMENT_FIELDS.has(o.field) && counts[o.field]));
        incoming.filter((o) => COMMENT_FIELDS.has(o.field)).forEach((o) => committedComments.set(o.field, o));
        useRosObservationsStore.setState(arrayToObject(incoming));
        useRosObservationsInitializationStore.setState({ hasInitialData: true });
        return Promise.resolve(true);
      }

      // Capture previous values for the fields being changed (for rollback)
      const prevState = useRosObservationsStore.getState();
      const prevValues = observations.reduce((acc, obs) => {
        acc[obs.field] = prevState[obs.field];
        return acc;
      }, {} as RosRecord);

      const toSave = observations.filter(isRosObservationSet);
      const toDelete = observations.filter((o) => !isRosObservationSet(o) && o.resourceId);
      const deletedFields = new Set(toDelete.map((o) => o.field));

      // Merge into store (same pattern as useExamObservations). Fields being deleted are stored
      // without their resourceId: the Observation is about to be gone, so re-checking the box has to
      // create a new one rather than PUT the id that was just deleted — which a "Clear ROS" or a
      // "Select all" turned off would otherwise do for a whole system at a time.
      useRosObservationsStore.setState(
        arrayToObject(
          observations.map((o) =>
            deletedFields.has(o.field) ? { field: o.field, label: o.label, value: false, note: '' } : o
          )
        )
      );

      const isCurrentGeneration = (): boolean => getRosStoreGeneration() === generation;
      const requests: Promise<boolean>[] = [];

      if (toSave.length > 0) {
        const request = saveChartData({ rosObservations: toSave }).then(
          (data) => {
            if (!isCurrentGeneration() || !data.chartData.rosObservations) return true;

            const returned = data.chartData.rosObservations;
            // If the user unset a field while the save was in flight, the resourceId was unknown
            // at that time so no delete was sent. Now that we have it, send the delete and skip the
            // overwrite; otherwise merge the server response (with resourceIds).
            const currentState = useRosObservationsStore.getState();
            const stillSet = returned.filter((obs) => isRosObservationSet(currentState[obs.field]));
            const needsDelete = returned.filter(
              (obs) => !isRosObservationSet(currentState[obs.field]) && obs.resourceId
            );

            returned
              .filter((obs) => COMMENT_FIELDS.has(obs.field))
              .forEach((obs) => committedComments.set(obs.field, needsDelete.includes(obs) ? undefined : obs));

            if (stillSet.length > 0) {
              // A comment may have been edited while saving, so only its resourceId is taken from the server.
              useRosObservationsStore.setState(
                arrayToObject(
                  stillSet.map((obs) =>
                    COMMENT_FIELDS.has(obs.field) ? { ...currentState[obs.field], resourceId: obs.resourceId } : obs
                  )
                )
              );
            }
            if (needsDelete.length > 0) {
              trackPendingObservationFields(
                needsDelete.map((obs) => obs.field),
                deleteChartData({ rosObservations: needsDelete })
              );
            }
            return true;
          },
          () => {
            enqueueSnackbar('An error occurred while saving ROS data. Please try again.', { variant: 'error' });
            // Restore only the fields this write changed, leaving the rest of the store alone
            if (isCurrentGeneration()) rollbackObservations(useRosObservationsStore, prevValues);
            return false;
          }
        );
        trackPendingObservationFields(
          toSave.map((o) => o.field),
          request
        );
        requests.push(request);
      }

      if (toDelete.length > 0) {
        const request = deleteChartData({ rosObservations: toDelete }).then(
          () => {
            if (isCurrentGeneration())
              toDelete.forEach((o) => COMMENT_FIELDS.has(o.field) && committedComments.delete(o.field));
            return true;
          },
          (error) => {
            console.error(error);
            return false;
          }
        );
        trackPendingObservationFields(
          toDelete.map((o) => o.field),
          request
        );
        requests.push(request);
      }

      return Promise.all(requests).then((results) => results.every(Boolean));
    },
    [saveChartData, deleteChartData]
  );

  const update = useCallback(
    (observations: ExamObservationDTO[], noFetch?: boolean) => {
      void write(observations, noFetch);
    },
    [write]
  );

  const updateComment = useCallback(
    (field: string, label: string, note: string, generation = getRosStoreGeneration()) => {
      if (generation !== getRosStoreGeneration()) return;
      syncCommentState();

      const current = useRosObservationsStore.getState()[field];
      useRosObservationsStore.setState({ [field]: { ...current, field, label, note, value: undefined } });

      const seq = (commentWrites.get(field)?.seq ?? 0) + 1;
      const isLatest = (): boolean => getRosStoreGeneration() === generation && commentWrites.get(field)?.seq === seq;
      const release = holdPendingObservationFields([field]);

      const chain = (commentWrites.get(field)?.chain ?? Promise.resolve())
        .then(async () => {
          if (!isLatest()) return;
          const resourceId = useRosObservationsStore.getState()[field]?.resourceId;
          const ok = await write([{ field, label, note, resourceId }]);
          if (!ok && isLatest()) restoreComment(field, committedComments.get(field));
        })
        .finally(release);

      commentWrites.set(field, { seq, chain });
    },
    [write]
  );

  return {
    update,
    updateComment,
    isLoading: isDeleteLoading || isSaveLoading,
    isFieldPending,
    observationMap: state,
  };
}
