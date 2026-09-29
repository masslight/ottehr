/** The structured gold a harvested case carries: what the clinician charted for the visit. */

// Scorable sections are always present (possibly empty), so an empty array means the clinician charted nothing
// rather than "not evaluated". Free-text sections are omitted when empty.
export interface CodeItem {
  system: string | null; // explicit code system, recorded at serialize time
  code: string; // verbatim from FHIR
  codeNormalized: string; // uppercase, whitespace + decimal dot stripped — the comparison key
  display: string;
}
export interface DiagnosisItem extends CodeItem {
  primary: boolean;
  fromLabOrder: boolean; // lab-order-added dx are not transcript-derivable
}
export interface BillingCode extends CodeItem {
  modifiers?: { code: string; display: string }[];
  units?: number;
}
export interface ExamItem {
  field: string; // match key (exam-observation-field code); stable, unlike label
  label?: string;
  present?: boolean;
  abnormal?: boolean;
  note?: string;
  components?: { code: string; label: string; value: boolean; abnormal?: boolean }[];
}
// Patient instruction (CommunicationDTO). Education-doc instructions carry only a title +
// DocumentReference (no text) — hasEducationDoc records that without leaking the FHIR id.
export interface InstructionItem {
  title?: string;
  text?: string;
  hasEducationDoc?: boolean;
}

export interface GoldData {
  // Named after the signed note. Chart data's keys are cross-wired: chart.chiefComplaint holds the HPI and
  // chart.historyOfPresentIllness the "Additional information" (see the visit-note PDF sections).
  historyOfPresentIllness?: string;
  additionalInformation?: string;
  reviewOfSystems: { observations: ExamItem[]; freeText?: string };
  exam: ExamItem[];
  assessment: { diagnoses: DiagnosisItem[] };
  billing: { emCode?: BillingCode; cptCodes: BillingCode[] };
  medications: {
    prescribed: { name?: string; sig?: string; status?: string }[]; // eRx — name-only, not code-scorable
    inHouseAdministered: {
      name?: string;
      ndc?: string;
      cptCodes?: { code: string; display: string }[];
      dose?: number;
      units?: string;
      route?: string;
      status?: string;
    }[];
    immunizations: {
      name?: string;
      cvx?: string;
      ndc?: string;
      cptCodes?: { code: string; display: string }[];
      status?: string;
    }[];
    currentReconciled: { name?: string; dose?: string; type?: string; status?: string; context: true }[]; // context, not planner-scored
  };
  allergies: { name?: string; note?: string; context: true }[]; // context (prior chart)
  medicalHistory: {
    system: string | null;
    code?: string;
    codeNormalized?: string;
    display?: string;
    note?: string;
    current?: boolean;
    context: true;
  }[]; // context (prior chart)
  surgicalHistory: CodeItem[];
  hospitalizations: { code: string; codeNormalized: string; display: string }[];
  procedures: {
    procedureType?: string;
    cptCodes?: BillingCode[];
    diagnoses?: DiagnosisItem[];
    bodySite?: string;
    bodySide?: string;
    technique?: string[];
    details?: string;
  }[];
  labs: { external: unknown; inHouse: unknown };
  radiology: {
    studyType?: string;
    studyName?: string;
    cptCodeDisplay?: string;
    diagnosis?: string;
    clinicalHistory?: string;
    preliminaryReport?: string;
    finalReport?: string;
  }[];
  vitals: Record<string, unknown>[]; // context (intake vitals)
  medicalDecisionMaking?: string;
  // Full DispositionDTO capture (schema v2). Fields beyond type/note/followUp/followUpIn are
  // optional and absent in v1 cases; scorers should treat missing as "not charted".
  disposition?: {
    type?: string;
    note?: string;
    followUp?: { type?: string; note?: string }[];
    followUpIn?: number;
    reason?: string;
    specialty?: string;
    specialtyOther?: string;
    labService?: string[];
    virusTest?: string[];
    nothingToEatOrDrink?: boolean;
    refusalOfEmsTransport?: boolean;
  };
  instructions: string[]; // legacy flat text (v1); derived from instructionItems since v2
  instructionItems?: InstructionItem[]; // full-fidelity instructions (schema v2; absent in v1 cases)
  addendum?: string;
}
