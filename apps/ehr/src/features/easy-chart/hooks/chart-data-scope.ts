// Which scope each note section NEEDS, and why.
//
// `get-chart-data` fetches some fields PATIENT-scoped and some ENCOUNTER-scoped, and the difference is
// invisible at the call site: a patient-scoped field returns rows from every visit the patient has
// ever had, and the section renders them as if they belonged to this one. That is not a crash, it is
// a wrong note — `inhouseMedications` showed a medication given at a previous visit and omitted the
// one just given here.
//
// So the requirement is declared per section, next to the reason, and a test reads the zambda's own
// `defaultSearchBy` to check it. A field whose scope changes there breaks the test rather than the
// note.

/** What a section needs the data to be scoped to. */
export type RequiredScope =
  /** This visit only. Anything older is not part of this note. */
  | 'encounter'
  /** Genuinely patient-level: the fact is true of the patient, not of the visit. */
  | 'patient'
  /** Not chart data at all — the section has its own encounter-scoped query. */
  | 'separate-query';

export interface SectionScopeRequirement {
  /** The `GetChartDataResponse` key, or the source when `separate-query`. */
  field: string;
  required: RequiredScope;
  /** Why. A scope requirement with no reason is a scope requirement nobody can review. */
  reason: string;
}

export const SECTION_SCOPE_REQUIREMENTS: SectionScopeRequirement[] = [
  // ---- Genuinely patient-level. These SHOULD show history; that is the point of them. -------------
  {
    field: 'allergies',
    required: 'patient',
    reason: 'An allergy is a fact about the patient, not about a visit. It must carry across encounters.',
  },
  {
    field: 'conditions',
    required: 'patient',
    reason: 'Past medical history is patient-level by definition; this visit’s problems are diagnoses.',
  },
  {
    field: 'medications',
    required: 'patient',
    reason: 'Home / current medications are what the patient takes, independent of this encounter.',
  },
  {
    field: 'surgicalHistory',
    required: 'patient',
    reason: 'A past operation belongs to the patient. It is history by definition.',
  },
  {
    field: 'notes',
    required: 'patient',
    reason:
      'Per-section notes hang off the history sections they annotate, which are themselves patient-level. ' +
      'Matches how the progress note reads them, so the two surfaces show the same note.',
  },

  // ---- This visit only. A row from an older encounter here is a wrong note. -----------------------
  {
    field: 'vitalsObservations',
    required: 'encounter',
    reason: 'A vital is a measurement taken at THIS visit. Last month’s temperature is not this visit’s.',
  },
  {
    field: 'chiefComplaint',
    required: 'encounter',
    reason: 'The reason for THIS visit.',
  },
  {
    field: 'historyOfPresentIllness',
    required: 'encounter',
    reason: 'The story of the problem the patient came in with today.',
  },
  {
    field: 'mechanismOfInjury',
    required: 'encounter',
    reason: 'How today’s injury happened.',
  },
  {
    field: 'medicalDecision',
    required: 'encounter',
    reason: 'The reasoning behind today’s plan. A previous visit’s MDM would misstate what was decided.',
  },
  {
    field: 'ros',
    required: 'encounter',
    reason: 'What the patient reported and denied at THIS visit.',
  },
  {
    field: 'disposition',
    required: 'encounter',
    reason: 'Where the patient goes after this visit.',
  },
  {
    field: 'instructions',
    required: 'encounter',
    reason: 'What the patient takes home from this visit.',
  },
  {
    field: 'observations',
    required: 'encounter',
    reason: 'Screening answers given at this visit.',
  },
  {
    field: 'prescribedMedications',
    required: 'encounter',
    reason: 'Prescriptions written at this visit, distinct from what the patient already takes.',
  },
  {
    field: 'radiologyOrders',
    required: 'encounter',
    reason: 'Imaging ordered at this visit.',
  },
  {
    field: 'accident',
    required: 'encounter',
    reason: 'The accident details this visit records, which gate signing.',
  },
  {
    field: 'surgicalHistoryNote',
    required: 'encounter',
    reason: 'A note written at this visit about the surgical history, not the history itself.',
  },

  // ---- Not chart data. The patient-scoped chart field is the wrong source. ------------------------
  {
    field: 'inhouseMedications',
    required: 'separate-query',
    reason:
      'THE REGRESSION. Fetched PATIENT-scoped with a `_tag`, so it returned the patient’s in-house ' +
      'medication history across every visit — it showed a medication from a previous encounter and ' +
      'omitted the one just given here. The note pane takes MAR orders from the encounter-scoped ' +
      'get-medication-orders query instead, which is what Review & Sign does.',
  },
  {
    field: 'immunizations',
    required: 'separate-query',
    reason:
      'Not a chart-data field at all. get-immunization-orders, scoped to this encounter and filtered to ' +
      'administered — an ordered-but-not-given immunization is not part of the visit record.',
  },
];

/** Fields the note pane must NOT take from chart data, because that source is wrongly scoped. */
export const FIELDS_NOT_FROM_CHART_DATA = SECTION_SCOPE_REQUIREMENTS.filter(
  (requirement) => requirement.required === 'separate-query'
).map((requirement) => requirement.field);
