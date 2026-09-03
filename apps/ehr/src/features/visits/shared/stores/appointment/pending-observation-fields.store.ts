import { useCallback } from 'react';
import { create } from 'zustand';

type PendingObservationFieldsState = {
  /** Number of writes — in flight or still queued — touching each field. */
  counts: Record<string, number>;
};

/**
 * Tracks which observation fields have a save or delete in flight or queued.
 *
 * The mutation hooks behind useExamObservations / useRosObservations are instantiated per call
 * site, so their `isPending` only ever describes the component that fired the request — a bulk
 * write like "Select all" would otherwise leave the individual checkboxes it is rewriting live and
 * clickable, and the bulk response would then clobber whatever the user changed meanwhile.
 *
 * Exam and ROS share the store: their field names never collide, and the only consumer that asks
 * "is anything busy?" rather than naming its fields — "Clear Exam" — lives on a tab of its own, so
 * counting the other section's fields too can at worst disable a button the user is not looking at.
 *
 * Writes can overlap on a field (a bulk write plus a single toggle), hence refcounts rather than a
 * flag.
 */
export const usePendingObservationFieldsStore = create<PendingObservationFieldsState>()(() => ({ counts: {} }));

const adjust = (counts: Record<string, number>, fields: string[], delta: number): Record<string, number> => {
  const next = { ...counts };

  fields.forEach((field) => {
    const count = (next[field] ?? 0) + delta;
    if (count > 0) {
      next[field] = count;
    } else {
      delete next[field];
    }
  });

  return next;
};

/** Reads the busy fields, for the components and hooks that gate edits on them. */
export const usePendingObservationFields = (): {
  isFieldPending: (field: string) => boolean;
  hasPendingFields: boolean;
} => {
  const counts = usePendingObservationFieldsStore((state) => state.counts);

  return {
    isFieldPending: useCallback((field: string) => (counts[field] ?? 0) > 0, [counts]),
    hasPendingFields: Object.keys(counts).length > 0,
  };
};

/**
 * Refcounts `fields` until the returned release is called — for a write that is queued rather than
 * in flight, such as a debounced provider comment or a note save waiting on the resourceId of the
 * one before it. A "Clear" fired inside that window would be undone by the queued write landing on
 * top of it, so the field has to read as busy from the keystroke on, not from the moment the request
 * leaves. Releasing more than once is a no-op.
 */
export const holdPendingObservationFields = (fields: string[]): (() => void) => {
  usePendingObservationFieldsStore.setState((state) => ({ counts: adjust(state.counts, fields, 1) }));

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    usePendingObservationFieldsStore.setState((state) => ({ counts: adjust(state.counts, fields, -1) }));
  };
};

/**
 * Refcounts `fields` until `request` settles, however it settles.
 *
 * The release runs off the request promise rather than through react-query's per-call callbacks:
 * those are dropped whenever the calling component has unmounted or has since fired another
 * mutation on the same hook instance, and a release that never runs leaves the field — and every
 * "Select all" / "Clear" that watches it — disabled for the rest of the session.
 */
export const trackPendingObservationFields = (fields: string[], request: Promise<unknown>): void => {
  const release = holdPendingObservationFields(fields);

  void request.catch((error) => console.error(error)).finally(release);
};

/** Drops every refcount, e.g. when the chart being edited changes. */
export const resetPendingObservationFields = (): void =>
  usePendingObservationFieldsStore.setState({ counts: {} }, true);
