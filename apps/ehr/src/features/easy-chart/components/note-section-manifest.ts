// THE section manifest: every section of the visit note, and which surface renders it.
//
// Both columns are in ONE file so you cannot add a section to one surface without seeing the other.
// The plan's preferred shape is to make the progress note's own section list data and render both
// surfaces from it; until that refactor lands, this manifest plus the parity test in
// tests/unit/easy-chart-section-parity.test.ts is the minimum that keeps them from drifting.
//
// Why it matters: nothing a reviewer needs at sign-off may be missing from the Easy Chart view. A
// section that exists on the progress note and silently not here is a note the provider signs having
// never seen part of it.
//
// Order follows Review & Sign, so a provider reading both sees the same document.
//
// WHETHER a registered section actually renders is a separate question, answered by note-visibility.ts:
// the default is "only when it has content", and the exceptions are the privacy line (always) and the
// four free-text fields plus Vitals (also while empty, when editable, because a section you cannot see
// is a section you cannot type into).

export interface NoteSectionEntry {
  id: string;
  label: string;
  /** The component the progress note renders this with. Used by the parity test to read its source. */
  progressNoteComponent: string | null;
  /** Does the Easy Chart note pane render it? */
  easyChart: boolean;
  /**
   * Required when `easyChart` is false. A deliberate gap must be explained here — an unexplained one
   * is indistinguishable from an oversight.
   */
  easyChartOmissionReason?: string;
  /**
   * Set when Easy Chart renders this INSIDE another section rather than as one of its own — the legacy
   * free-text ROS lives under the structured Review of Systems heading, because two ROS headings would
   * read as two different reviews. It still has its own visibility rule.
   */
  renderedWithin?: string;
}

export const NOTE_SECTIONS: NoteSectionEntry[] = [
  { id: 'allergies', label: 'Allergies', progressNoteComponent: 'AllergiesContainer', easyChart: true },
  { id: 'intake-medications', label: 'Medications', progressNoteComponent: 'MedicationsContainer', easyChart: true },
  {
    id: 'medical-history',
    label: 'Medical History',
    progressNoteComponent: 'MedicalConditionsContainer',
    easyChart: true,
  },
  {
    id: 'surgical-history',
    label: 'Surgical History',
    progressNoteComponent: 'SurgicalHistoryContainer',
    easyChart: true,
  },
  {
    id: 'hospitalizations',
    label: 'Hospitalizations',
    progressNoteComponent: 'HospitalizationContainer',
    easyChart: true,
  },
  {
    id: 'in-house-medications',
    label: 'In-House Medications',
    progressNoteComponent: 'InHouseMedicationsContainer',
    easyChart: true,
  },
  { id: 'immunization', label: 'Immunization', progressNoteComponent: 'ImmunizationContainer', easyChart: true },
  {
    id: 'chief-complaint',
    label: 'Chief Complaint',
    progressNoteComponent: 'ChiefComplaintContainer',
    easyChart: true,
  },
  {
    id: 'hpi',
    label: 'History of Present Illness',
    progressNoteComponent: 'HistoryOfPresentIllnessContainer',
    easyChart: true,
  },
  {
    id: 'mechanism-of-injury',
    label: 'Mechanism of Injury',
    progressNoteComponent: 'MechanismOfInjuryContainer',
    easyChart: true,
  },
  {
    id: 'ros-legacy',
    label: 'Review of Systems (legacy free text)',
    progressNoteComponent: 'ReviewOfSystemsContainer',
    easyChart: true,
    renderedWithin: 'ros',
  },
  { id: 'ros', label: 'Review of Systems', progressNoteComponent: 'RosReviewContainer', easyChart: true },
  {
    id: 'additional-questions',
    label: 'Additional questions',
    progressNoteComponent: 'AdditionalQuestionsContainer',
    easyChart: true,
  },
  { id: 'vitals', label: 'Vitals', progressNoteComponent: 'PatientVitalsContainer', easyChart: true },
  { id: 'examination', label: 'Examination', progressNoteComponent: 'ExaminationContainer', easyChart: true },
  { id: 'procedures', label: 'Procedures', progressNoteComponent: 'ProceduresContainer', easyChart: true },
  { id: 'assessment', label: 'Assessment / Diagnoses', progressNoteComponent: 'AssessmentContainer', easyChart: true },
  {
    id: 'mdm',
    label: 'Medical Decision Making',
    progressNoteComponent: 'MedicalDecisionMakingContainer',
    easyChart: true,
  },
  { id: 'em-code', label: 'E&M Code', progressNoteComponent: 'EMCodeContainer', easyChart: true },
  { id: 'cpt-codes', label: 'CPT Codes', progressNoteComponent: 'CPTCodesContainer', easyChart: true },
  {
    id: 'labs-ordered',
    label: 'Labs ordered',
    // The progress note shows lab RESULTS; the orders come from their own two list endpoints.
    progressNoteComponent: null,
    easyChart: true,
  },
  {
    id: 'lab-results',
    label: 'Lab Results',
    progressNoteComponent: 'LabResultsReviewContainer',
    easyChart: true,
  },
  {
    id: 'radiology',
    label: 'Radiology',
    progressNoteComponent: 'RadiologyOrdersContainer',
    easyChart: true,
  },
  {
    id: 'prescriptions',
    label: 'Prescriptions',
    progressNoteComponent: 'PrescribedMedicationsContainer',
    easyChart: true,
  },
  {
    id: 'patient-instructions',
    label: 'Patient Instructions',
    progressNoteComponent: 'PatientInstructionsContainer',
    easyChart: true,
  },
  {
    id: 'school-work-excuse',
    label: 'School / Work Excuse',
    progressNoteComponent: null,
    easyChart: true,
  },
  // Sections the progress note PAGE renders outside ProgressNoteDetails, or that Easy Chart adds.
  { id: 'disposition', label: 'Disposition', progressNoteComponent: null, easyChart: true },
  {
    id: 'privacy-policy',
    label: 'Privacy policy acknowledgement',
    progressNoteComponent: 'PrivacyPolicyAcknowledgement',
    easyChart: true,
  },
  { id: 'addendum', label: 'Addendum', progressNoteComponent: null, easyChart: true },
  {
    id: 'exam-migration-warning',
    label: 'Exam migration warning',
    progressNoteComponent: 'ExamMigrationWarning',
    easyChart: false,
    easyChartOmissionReason:
      'Not a note section — a warning banner offering the one-click exam-config migration. Easy Chart surfaces migration-needed findings by their raw field name in the exam section instead; wiring the migration action here is a follow-up.',
  },
];

/** Section ids the Easy Chart note pane must render, in order. */
export const EASY_CHART_SECTION_IDS = NOTE_SECTIONS.filter((section) => section.easyChart).map((section) => section.id);

/** The subset that is a section of its own, i.e. one entry in the note pane's own list. */
export const EASY_CHART_TOP_LEVEL_SECTION_IDS = NOTE_SECTIONS.filter(
  (section) => section.easyChart && !section.renderedWithin
).map((section) => section.id);

/** Component names the progress note renders, for the source-reading parity test. */
export const PROGRESS_NOTE_SECTION_COMPONENTS = NOTE_SECTIONS.map((section) => section.progressNoteComponent).filter(
  (name): name is string => name !== null
);
