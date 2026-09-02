/**
 * A record, carried inside a document, of which patient it was produced for.
 *
 * Documents this system generates leave it: they are downloaded, completed by hand, and uploaded back.
 * Everything else in this codebase binds a document to a patient structurally — a fax packet finds its
 * contents by searching `encounter` + `type`, so it physically cannot pick up another patient's record.
 * The upload step is the one place where that binding is a human intention rather than a query: someone
 * choosing a file from a dialog full of near-identically named PDFs, each holding a different patient's
 * details.
 *
 * A stamped document can be checked against the chart it is being filed onto, which turns "trust the
 * person to pick the right file" into "verify the artifact".
 *
 * **Opt-in by shape, not by type.** The upload guard looks for this structure and nothing else: a stamped
 * document is verified, an unstamped one is saved exactly as before. Any workflow that begins stamping its
 * documents is protected from that moment, with no change to the guard.
 *
 * ⚠️ Not a security control. The stamp is hidden and marked read-only, both of which a determined person
 * strips in a minute. It defends against a misfiled download on a busy afternoon, not against intent.
 */
export interface DocumentProvenance {
  /** Schema version, so a stamp written by an older build stays readable. */
  v: 1;
  /** The patient this document was produced for. The only field the upload guard consults. */
  patientId: string;
  encounterId?: string;
  /** What the document was generated from — a form template, a note definition — where there was one. */
  sourceId?: string;
  /** The source's `meta.versionId` at the time, so a later edit to it is detectable. */
  sourceVersion?: string;
  /** When the document was produced, ISO 8601. */
  at: string;
}

/** Outcome of checking an uploaded document against the chart it was filed onto. */
export type DocumentVerificationStatus =
  /** No stamp. Saved as before — most documents reach a chart without passing through us. */
  | 'unstamped'
  /** Stamped, and the stamp agrees with the chart. */
  | 'verified'
  /** Stamped for a different patient. No record is written and the uploaded bytes are discarded. */
  | 'patientMismatch';

/**
 * The shape a workflow should follow to adopt this guard.
 *
 * Upload in two steps rather than one. The first mints a presigned URL and writes **nothing** — no
 * DocumentReference, no folder entry. The second runs once the bytes are in place: it reads the stamp,
 * compares it against the chart determined server-side, and only then creates the record.
 *
 * Inverting the order is what makes the check meaningful. Creating the record first and deleting it on a
 * mismatch leaves a window where another patient's document is on the chart, and leaves an orphaned
 * record behind whenever an upload simply fails — neither of which can happen if the record is the reward
 * for passing rather than the thing being undone.
 *
 * The chart is never taken from the client. The caller names a visit, the patient is resolved from it
 * server-side, and the stamp comes from the file, so a mismatch is a disagreement between two sources
 * neither of which the caller chose.
 */
export interface DocumentVerificationResult {
  status: DocumentVerificationStatus;
  /** Present on a mismatch, for a message that says what actually happened. */
  stampedPatientId?: string;
}
