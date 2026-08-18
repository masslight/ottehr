// CLICK-TO-CORRECT: the per-field search and the per-field write, as two tables.
//
// A charted row is corrected in place — click it, search the same catalogue the assistant resolved
// against, pick the right row. The two halves are separate tables rather than one function per field
// because they answer different questions, and keeping them side by side makes a mismatch obvious:
// searching the medication catalogue and then writing an allergy is the failure this shape prevents.
//
// THE RULE BOTH HALVES OBEY: `id` and `display` come from ONE catalogue row, never mixed. That is the
// same rule the server applies to codes — a code from one row with a label from another is a wrong
// entry that reads as a right one.

import { Catalogue, CatalogueResult } from './types';

/** The catalogue a field's correction searches. A field absent here has nothing to search against. */
export const CORRECTION_SEARCH: Record<string, (catalogue: Catalogue, query: string) => Promise<CatalogueResult>> = {
  allergies: (catalogue, query) => catalogue.allergies({ display: query }),
  medications: (catalogue, query) => catalogue.medications({ display: query }),
  conditions: (catalogue, query) => catalogue.conditions({ display: query }),
  surgicalHistory: (catalogue, query) => catalogue.surgicalHistory({ display: query }),
  episodeOfCare: (catalogue, query) => catalogue.hospitalizations({ display: query }),
  examObservations: (catalogue, query) => catalogue.examFindings({ display: query }),
  rosObservations: (catalogue, query) => catalogue.rosFindings({ display: query }),
};

/** One chosen replacement, as the picker hands it over. */
export interface CorrectionChoice {
  id: string;
  display: string;
}

/**
 * The write for a chosen replacement. Returns the chart-data payload that REPLACES the row; the caller
 * deletes the old one, so a correction never leaves both versions on the note.
 */
export const CORRECTION_WRITE: Record<
  string,
  (option: CorrectionChoice, existing?: Record<string, unknown>) => Record<string, unknown>
> = {
  allergies: (option) => ({ allergies: [{ id: option.id, name: option.display, current: true }] }),
  // The dosage qualifier survives the swap: correcting the DRUG must not silently drop the fact that
  // the patient could not confirm its dose.
  medications: (option, existing) => ({
    medications: [
      {
        name: option.display,
        ...(existing?.intakeInfo ? { intakeInfo: existing.intakeInfo } : {}),
      },
    ],
  }),
  conditions: (option) => ({ conditions: [{ code: option.id, display: option.display, current: true }] }),
  surgicalHistory: (option) => ({ surgicalHistory: [{ code: option.id, display: option.display }] }),
  episodeOfCare: (option) => ({ episodeOfCare: [{ code: option.id, display: option.display }] }),
  // Correcting an exam finding replaces the whole row, so the option's component is not carried here —
  // the picker's `id` is already the saveable parent field.
  examObservations: (option) => ({ examObservations: [{ field: option.id, value: true }] }),
  // ROS stores its polarity in the field suffix. A correction keeps the polarity of what it replaces,
  // which the caller encodes into the id, so the suffix is preserved rather than reset to "reports".
  rosObservations: (option) => ({ rosObservations: [{ field: option.id, value: true }] }),
};
