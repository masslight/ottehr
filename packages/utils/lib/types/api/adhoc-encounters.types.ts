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
}

export interface AdHocEncountersOutput {
  encounters: AdHocEncounterRow[];
}
