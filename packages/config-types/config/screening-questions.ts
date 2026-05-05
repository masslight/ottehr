/**
 * Screening Questions Configuration Types
 *
 * These types define the contract for patient screening question configurations,
 * supporting various field types with FHIR mappings and conditional logic.
 */

/**
 * Field types for screening questions
 */
export type ScreeningFieldType = 'radio' | 'text' | 'textarea' | 'select' | 'dateRange' | 'date';

/**
 * Option for select/radio fields
 */
export interface ScreeningFieldOption {
  value: string;
  label: string;
  fhirValue: string;
}

/**
 * Note field for additional input
 */
export interface ScreeningNoteField {
  id: string;
  label: string;
  type: 'text' | 'textarea';
  placeholder?: string;
  fhirField: string;
  conditionalValue?: string;
}

/**
 * Conditional save configuration
 */
export interface ScreeningConditionalSave {
  waitForNote: string;
}

/**
 * Per-flow plumbing for a screening field.
 *
 * `addedManuallyToConfig` declares whether this flow's source config already
 * wires up the question (e.g. it is hand-placed in the booking form). When
 * `false`, auto-injection generates the question's form item; when `true`,
 * auto-injection skips it but the rest of the pipeline (pre-population,
 * harvest, EHR/PDF) still uses `fhirField` for data plumbing.
 *
 * `fhirField` is the linkId the question carries inside *that flow's*
 * questionnaire response. It can differ across flows (e.g. virtual paperwork
 * uses 'covid-symptoms' while in-person booking historically uses
 * 'return-patient-check' for an equivalent concept).
 */
export interface ScreeningFlowEntry {
  addedManuallyToConfig: boolean;
  fhirField: string;
}

/**
 * Screening question field.
 *
 * Two-level identification:
 *  - `id`: stable identifier of the screening question itself (snake_case).
 *  - `observationField`: canonical FHIR `Observation.field` name. Used by
 *    harvest, EHR/PDF, AskThePatient — the clinical record key, flow-agnostic.
 *  - `flowConfig.<flow>.fhirField`: per-flow QR linkId. Harvest reads the QR
 *    by this linkId then writes the Observation under `observationField`,
 *    so a single conceptual answer maps to one chart record regardless of
 *    which flow the patient went through.
 *
 * A field with no `flowConfig` (or with no entries) is an "ASK THE PATIENT"
 * field — it never appears in patient-facing questionnaires; staff fills it
 * during the visit.
 */
export interface ScreeningField {
  id: string;
  type: ScreeningFieldType;
  question: string;
  required?: boolean;
  options?: ScreeningFieldOption[];
  placeholder?: string;
  observationField: string;
  noteField?: ScreeningNoteField;
  debounced?: boolean;
  canDelete?: boolean;
  conditionalSave?: ScreeningConditionalSave;
  flowConfig?: {
    virtual?: ScreeningFlowEntry;
    inPerson?: ScreeningFlowEntry;
  };
  /**
   * If true, the field's chart Observation is fed into the E&M billing
   * recommendation prompt as `{ question, answer }`. Off by default — set
   * per-field for screening answers that genuinely inform billing complexity.
   * Bespoke channels (e.g. the legacy `seen-in-last-three-years` lookup that
   * sets `newPatient`) keep their own special-case handling.
   */
  includeInBillingRecommendations?: boolean;
}

/**
 * Full screening questions configuration
 */
export interface ScreeningQuestionsConfig {
  title: string;
  fields: ScreeningField[];
}
