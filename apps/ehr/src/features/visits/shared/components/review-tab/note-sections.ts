// THE canonical list of visit-note sections, and which surfaces render each one.
//
// The same note is presented by two independent renderers: Review & Sign
// (ProgressNoteDetails.tsx) and the Easy Chart page (NoteSections.tsx + EasyChartPage.tsx). Easy
// Chart promises that "nothing a reviewer needs at sign-off is missing from the Easy Chart view", but
// the two renderers share no code and no list — so a section added to the progress note simply never
// appears in Easy Chart, and nothing says so. Whoever adds the next section sees both columns here
// and the parity test (note-section-parity.test.ts) fails until they fill them in.
//
// This file is a MANIFEST, not a renderer: adding an id here does not render anything. It exists so
// the omission is loud instead of silent.

export const NOTE_SECTIONS = [
  { id: 'exam-migration-warning', label: 'Exam configuration mismatch warning' },
  { id: 'chief-complaint', label: 'Chief Complaint' },
  { id: 'hpi', label: 'History of Present Illness' },
  { id: 'mechanism-of-injury', label: 'Mechanism of Injury' },
  { id: 'ros', label: 'Review of Systems' },
  { id: 'additional-questions', label: 'Screening questions' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'examination', label: 'Examination' },
  { id: 'allergies', label: 'Allergies' },
  { id: 'intake-medications', label: 'Medications' },
  { id: 'medical-conditions', label: 'Medical History' },
  { id: 'surgical-history', label: 'Surgical History' },
  { id: 'hospitalization', label: 'Hospitalizations' },
  { id: 'in-house-medications', label: 'In-house medications (MAR)' },
  { id: 'immunizations', label: 'Immunizations' },
  { id: 'assessment', label: 'Assessment / Diagnoses' },
  { id: 'mdm', label: 'Medical Decision Making' },
  { id: 'em-code', label: 'E&M Code' },
  { id: 'cpt-codes', label: 'CPT Codes' },
  { id: 'in-house-lab-results', label: 'In-house lab results' },
  { id: 'external-lab-results', label: 'Send-out lab results' },
  { id: 'radiology', label: 'Radiology' },
  { id: 'procedures', label: 'Procedures' },
  { id: 'prescribed-medications', label: 'Prescriptions' },
  { id: 'patient-instructions', label: 'Patient instructions / disposition / excuse' },
  { id: 'privacy-policy', label: 'Privacy policy acknowledgement' },
] as const;

export type NoteSectionId = (typeof NOTE_SECTIONS)[number]['id'];

// What Review & Sign renders (ProgressNoteDetails.tsx's `sections` + `medicalHistorySections`).
export const PROGRESS_NOTE_SECTION_IDS = [
  'exam-migration-warning',
  'chief-complaint',
  'hpi',
  'mechanism-of-injury',
  'ros',
  'additional-questions',
  'vitals',
  'examination',
  'allergies',
  'intake-medications',
  'medical-conditions',
  'surgical-history',
  'hospitalization',
  'in-house-medications',
  'immunizations',
  'assessment',
  'mdm',
  'em-code',
  'cpt-codes',
  'in-house-lab-results',
  'external-lab-results',
  'radiology',
  'procedures',
  'prescribed-medications',
  'patient-instructions',
  'privacy-policy',
] as const satisfies readonly NoteSectionId[];

// What the Easy Chart page renders (NoteSections.tsx plus the sections EasyChartPage composes around
// it). Must cover everything above — see EASY_CHART_SECTION_EXCLUSIONS for the sanctioned gaps.
export const EASY_CHART_SECTION_IDS = [
  'exam-migration-warning',
  'chief-complaint',
  'hpi',
  'mechanism-of-injury',
  'ros',
  'additional-questions',
  'vitals',
  'examination',
  'allergies',
  'intake-medications',
  'medical-conditions',
  'surgical-history',
  'hospitalization',
  'in-house-medications',
  'immunizations',
  'assessment',
  'mdm',
  'em-code',
  'cpt-codes',
  'in-house-lab-results',
  'external-lab-results',
  'radiology',
  'procedures',
  'prescribed-medications',
  'patient-instructions',
  'privacy-policy',
] as const satisfies readonly NoteSectionId[];

// Sections Easy Chart deliberately does NOT render, each with the reason. Empty is the goal; an entry
// here is a conscious, reviewable decision rather than an accident. The parity test treats these as
// allowed gaps and nothing else.
export const EASY_CHART_SECTION_EXCLUSIONS: Partial<Record<NoteSectionId, string>> = {};

// The React component names that carry each section in ProgressNoteDetails.tsx. The parity test reads
// that file and asserts every section-bearing component it renders appears here — that is what makes
// the manifest load-bearing: a new `<SomethingContainer />` dropped into the sections array fails the
// test until it is registered and given an Easy Chart counterpart (or a documented exclusion).
export const PROGRESS_NOTE_SECTION_COMPONENTS: Record<string, NoteSectionId> = {
  ExamMigrationWarning: 'exam-migration-warning',
  ChiefComplaintContainer: 'chief-complaint',
  HistoryOfPresentIllnessContainer: 'hpi',
  MechanismOfInjuryContainer: 'mechanism-of-injury',
  ReviewOfSystemsContainer: 'ros',
  RosReviewContainer: 'ros',
  AdditionalQuestionsContainer: 'additional-questions',
  PatientVitalsContainer: 'vitals',
  ExaminationContainer: 'examination',
  AllergiesContainer: 'allergies',
  MedicationsContainer: 'intake-medications',
  MedicalConditionsContainer: 'medical-conditions',
  SurgicalHistoryContainer: 'surgical-history',
  HospitalizationContainer: 'hospitalization',
  InHouseMedicationsContainer: 'in-house-medications',
  ImmunizationContainer: 'immunizations',
  AssessmentContainer: 'assessment',
  MedicalDecisionMakingContainer: 'mdm',
  EMCodeContainer: 'em-code',
  CPTCodesContainer: 'cpt-codes',
  LabResultsReviewContainer: 'in-house-lab-results',
  RadiologyOrdersContainer: 'radiology',
  ProceduresContainer: 'procedures',
  PrescribedMedicationsContainer: 'prescribed-medications',
  PatientInstructionsContainer: 'patient-instructions',
  PrivacyPolicyAcknowledgement: 'privacy-policy',
};
