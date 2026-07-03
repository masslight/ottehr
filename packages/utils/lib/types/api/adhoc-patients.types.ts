// A one-row-per-PATIENT dataset for ad-hoc reporting — the patient-centric counterpart to the
// Encounters dataset. Each row is a patient seen in the date range, with demographics + a summary of
// their visits in that window. Patient-bound clinical layers (allergies / problem list / current
// medications) are opt-in, since they are attributes of the patient rather than of a single visit.

export interface AdHocPatientsInput {
  dateRange: { start: string; end: string };
  /** Patient allergy list (adds AllergyIntolerance to the search). */
  includeAllergies?: boolean;
  /** Problem list / chronic conditions (adds Condition to the search). */
  includeProblems?: boolean;
  /** Current/home medications (adds MedicationStatement to the search). */
  includeMedications?: boolean;
  /** Past surgical history (adds surgical-history Procedures to the search). */
  includeSurgicalHistory?: boolean;
  /** Prior hospitalizations (adds EpisodeOfCare to the search). */
  includeHospitalizations?: boolean;
}

export interface AdHocPatientRow {
  // --- Patient ---
  patientId: string;
  firstName: string;
  lastName: string;
  patientName: string;
  dateOfBirth: string | null;
  age: number | null;
  sex: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  source: string; // point of discovery / marketing
  // --- Visit summary (within the date range) ---
  totalVisits: number;
  // The zambda emits these as RAW ISO visit starts (the server never zone-formats them); the
  // client dataset rewrites them to the VIEWER-LOCAL yyyy-MM-dd day before any report sees them.
  firstVisitDate: string;
  lastVisitDate: string;
  lastVisitStatus: string;
  visitTypes: string[]; // distinct "In-Person" / "Telemed"
  locations: string[]; // distinct clinic names seen
  providers: string[]; // distinct attending providers seen
  serviceCategories: string[]; // distinct service lines seen
  // --- Allergies (includeAllergies) ---
  allergies?: string[]; // allergen display names
  allergyCount?: number;
  // --- Problem list (includeProblems) ---
  problems?: string[]; // ICD-10 condition display names
  problemCodes?: string[]; // ICD-10 codes
  problemCount?: number;
  // --- Current medications (includeMedications) ---
  currentMedications?: string[]; // home/current drug display names
  currentMedicationCount?: number;
  // --- Surgical history (includeSurgicalHistory) ---
  surgicalHistory?: string[]; // past surgery/procedure names
  surgicalHistoryCount?: number;
  // --- Hospitalizations (includeHospitalizations) ---
  hospitalizations?: string[]; // prior hospitalization reasons
  hospitalizationCount?: number;
}

export interface AdHocPatientsOutput {
  patients: AdHocPatientRow[];
}
