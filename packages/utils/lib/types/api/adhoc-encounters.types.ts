// A wide, one-row-per-encounter dataset for ad-hoc reporting. Always carries visit + patient +
// location/provider fields; the opt-in layers (codes / KPI timing / AI) are toggled per request so a
// report can be as light or heavy as it needs. Billing and new/established are a later, separate-root
// layer.

export interface AdHocEncountersInput {
  dateRange: { start: string; end: string };
  /** ICD / CPT / E&M codes charted on the visit (adds Condition + Procedure to the search). */
  includeCodes?: boolean;
  /** Per-visit KPI timing from the encounter's status history (cheap — already on the Encounter). */
  includeTiming?: boolean;
  /** AI-assistance flags (adds DocumentReference to the search). */
  includeAi?: boolean;
  /** Prescribed (eRx) medications charted on the visit (adds MedicationRequest to the search). */
  includeMedications?: boolean;
  /** Vital signs charted on the visit (adds vitals Observations to the search). */
  includeVitals?: boolean;
  /** Lab orders placed on the visit (adds lab ServiceRequests to the search). */
  includeLabs?: boolean;
  /** Imaging/radiology orders placed on the visit (adds radiology ServiceRequests to the search). */
  includeImaging?: boolean;
  /** Immunizations/vaccines given on the visit (adds immunization Medication resources to the search). */
  includeImmunizations?: boolean;
  /** Disposition / follow-up plan charted on the visit (adds disposition ServiceRequests to the search). */
  includeDisposition?: boolean;
  /** Structured ROS + physical-exam findings (adds ros/exam Observations to the search). */
  includeExamRos?: boolean;
  /** Lab/imaging RESULTS (adds DiagnosticReports to the search). */
  includeResults?: boolean;
  /** Nursing orders (adds nursing ServiceRequests to the search). */
  includeNursing?: boolean;
  /** Intake screenings — ASQ, accident, birth history (adds those Observations/Conditions). */
  includeIntake?: boolean;
  /** Work/school notes issued on the visit (adds school-work DocumentReferences). */
  includeDocuments?: boolean;
}

export interface AdHocEncounterRow {
  // --- Visit ---
  appointmentId: string;
  encounterId?: string;
  date: string; // yyyy-MM-dd (visit start)
  visitType: string; // "In-Person" | "Telemed"
  appointmentType: string; // "walk-in" | "pre-booked" | "post-telemed"
  serviceCategory: string; // service line, e.g. "Urgent Care"
  visitStatus: string;
  encounterType: string; // "main" | "follow-up" | "scheduled-follow-up"
  reason: string;
  scheduledSlotMinutes: number | null;
  // --- Patient ---
  patientId: string;
  firstName: string;
  lastName: string;
  patientName: string;
  dateOfBirth: string | null;
  sex: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  source: string; // point of discovery / marketing
  // --- Location / Provider ---
  location: string;
  locationId?: string;
  region: string; // clinic region (proxied by the location's state)
  clinicOpenHours: number | null; // hours the clinic is open on this visit's weekday
  attendingProvider: string;
  attendingProviderId?: string;
  // --- Registration ---
  registrationChannel: string; // "Staff" | "Self-scheduled" | "Walk-in" | "Unknown"
  registeredBy: string; // staff email for staff-created visits, "Patient" otherwise
  registeredByName: string; // registrar's full name (resolved from the staff email), or registeredBy when unresolved
  // --- Codes (includeCodes) ---
  icdCodes?: string[];
  icdDisplays?: string[];
  primaryIcd?: string;
  primaryIcdDisplay?: string;
  cptCodes?: string[];
  cptDisplays?: string[];
  emCode?: string;
  emDisplay?: string;
  // --- KPI timing (includeTiming) ---
  timeWithProviderMinutes?: number | null;
  arrivedToProviderMinutes?: number | null;
  arrivedToIntakeMinutes?: number | null;
  intakeToProviderMinutes?: number | null;
  providerToDischargedMinutes?: number | null;
  totalCycleMinutes?: number | null;
  onTime?: boolean | null;
  // --- AI (includeAi) ---
  aiType?: string; // "" | "ambient scribe" | "patient HPI chatbot" | "ambient scribe & patient HPI chatbot"
  // --- Medications (includeMedications) — eRx prescribed + in-house administered, all statuses ---
  medications?: string[]; // full drug display names (e.g. "Amoxicillin 500 mg tablet"); eRx + in-house combined
  medicationIngredients?: string[]; // drug name with dose/strength removed (e.g. "Ibuprofen Oral Tablet") — count by this
  medicationSources?: string[]; // parallel to medications: "eRx" or "in-house" for each entry
  medicationCodes?: string[]; // Medispan dispensable-drug-id codes (eRx only; in-house may be blank)
  medicationCount?: number; // total medications on the visit (eRx + in-house)
  // --- Vitals (includeVitals) — most recent charted value per vital on the visit ---
  temperatureF?: number | null; // body temperature, normalized to Fahrenheit
  heartRate?: number | null; // beats/min
  respirationRate?: number | null; // breaths/min
  oxygenSaturation?: number | null; // %
  systolicBP?: number | null; // mmHg
  diastolicBP?: number | null; // mmHg
  weightKg?: number | null; // weight normalized to kilograms
  heightCm?: number | null; // height normalized to centimeters
  bmi?: number | null; // body mass index, computed from weightKg/heightCm when both present
  // --- Lab orders (includeLabs) — placed on the visit, excludes revoked ---
  labOrders?: string[]; // lab test names ordered on the visit
  labOrderCount?: number;
  // --- Imaging orders (includeImaging) — radiology placed on the visit, excludes revoked ---
  imagingOrders?: string[]; // imaging study names ordered on the visit
  imagingOrderCount?: number;
  // --- Immunizations (includeImmunizations) — vaccines given on the visit ---
  immunizations?: string[]; // vaccine names administered/recorded on the visit
  immunizationCount?: number;
  // --- Disposition (includeDisposition) — discharge/follow-up plan ---
  followUpTypes?: string[]; // charted follow-up plan types (e.g. "Follow-up visit", "ED", "PCP")
  followUpCount?: number;
  dischargeDisposition?: string; // discharge disposition from the encounter, when recorded
  // --- Exam & ROS findings (includeExamRos) ---
  rosFindings?: string[]; // ROS items with state, e.g. "Reports Chills", "Denies Fever"
  examSystems?: string[]; // body systems/parts examined, e.g. "Ankle", "Alert"
  examFindings?: string[]; // specific physical-exam finding keys (e.g. "ankle-right-tenderness-bony")
  // --- Lab/imaging results (includeResults) ---
  resultNames?: string[]; // names of resulted lab/imaging studies (DiagnosticReport)
  resultCount?: number;
  abnormalResultCount?: number; // results flagged abnormal/inconclusive
  // --- Nursing orders (includeNursing) ---
  nursingOrders?: string[];
  nursingOrderCount?: number;
  // --- Intake screenings (includeIntake) ---
  asqScreen?: string; // ASQ screen result ("Negative" | "Positive" | "Declined" | "NotOffered" | "")
  accidentType?: string; // accident type when the visit was accident-related, else ""
  birthHistory?: string[]; // birth-history items (peds), when charted
  // --- Documents (includeDocuments) ---
  workSchoolNotes?: string[]; // "school" / "work" per note issued on the visit
  workSchoolNoteCount?: number;
}

export interface AdHocEncountersOutput {
  encounters: AdHocEncounterRow[];
}
