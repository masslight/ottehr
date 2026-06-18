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
  // --- Codes (includeCodes) ---
  icdCodes?: string[];
  primaryIcd?: string;
  cptCodes?: string[];
  emCode?: string;
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
  // --- Medications (includeMedications) — prescribed (eRx) on the visit ---
  medications?: string[]; // full drug display names as prescribed (e.g. "Amoxicillin 500 mg tablet")
  medicationIngredients?: string[]; // drug name with dose/strength removed (e.g. "Ibuprofen Oral Tablet") — count by this
  medicationCodes?: string[]; // Medispan dispensable-drug-id codes
  medicationCount?: number; // number of prescriptions written on the visit
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
}

export interface AdHocEncountersOutput {
  encounters: AdHocEncounterRow[];
}
