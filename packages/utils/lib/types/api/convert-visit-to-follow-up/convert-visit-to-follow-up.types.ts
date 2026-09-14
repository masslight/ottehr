/**
 * Converts a standalone visit into a scheduled follow-up of an earlier visit, in place.
 *
 * The visit keeps its Slot, Appointment and Encounter — only the Encounter's `type` and
 * `partOf` change — so documentation already recorded against the encounter stays attached.
 * Annotation follow-ups are not reachable this way; conversion always produces the
 * `scheduled` subtype.
 */
export interface ConvertVisitToFollowUpInput {
  /** Encounter of the visit being converted. Its Appointment is resolved from it. */
  encounterId: string;
  /** Encounter of the initial visit the converted visit becomes a follow-up of. */
  parentEncounterId: string;
  /** Skips diagnosis carry-over from the parent encounter. Matches `FollowUpOptions`. */
  skipPatientDiagnosis?: boolean;
}

export interface ConvertVisitToFollowUpResponse {
  /** The converted visit's encounter — unchanged, and still the target for chart writes. */
  encounterId: string;
  /** How many parent diagnoses were cloned onto the converted encounter. */
  diagnosesCarriedOver: number;
}
