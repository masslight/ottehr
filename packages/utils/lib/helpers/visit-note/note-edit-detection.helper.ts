import { DateTime } from 'luxon';

// Communication.sent (createdAt) and meta.lastUpdated are set in the same FHIR transaction
// when a note is first created, so they're never byte-identical. Treat lastUpdated within this
// window of createdAt as the same save; only a larger gap counts as a real edit.
export const NOTE_EDIT_DETECTION_WINDOW_MS = 5_000;

export const isNoteEdited = (createdAt?: string, lastUpdated?: string): boolean => {
  if (!createdAt || !lastUpdated) return false;
  const created = DateTime.fromISO(createdAt);
  const updated = DateTime.fromISO(lastUpdated);
  if (!created.isValid || !updated.isValid) return false;
  return updated.toMillis() - created.toMillis() > NOTE_EDIT_DETECTION_WINDOW_MS;
};
