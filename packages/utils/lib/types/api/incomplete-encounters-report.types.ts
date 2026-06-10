export type EncounterStatusFilter = 'incomplete' | 'complete' | 'all';

export interface IncompleteEncountersReportZambdaInput {
  dateRange: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
  encounterStatus?: EncounterStatusFilter; // defaults to 'incomplete'
  // When true, also join each encounter's charted codes (ICD-10 diagnoses, CPT codes, E&M code).
  // Off by default — the extra FHIR includes are only worth it for consumers that need them
  // (ad-hoc reporting); the report pages don't.
  includeCodes?: boolean;
}

export interface IncompleteEncounterItem {
  appointmentId: string;
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  visitStatus: string;
  appointmentStart: string;
  appointmentEnd: string;
  location?: string;
  locationId?: string;
  attendingProvider?: string;
  visitType?: string;
  reason?: string;
  // Minutes the visit spent in "provider" status (time actually with the provider, from the
  // encounter's visit-status history). Excludes waiting room / intake. Only closed status periods
  // are counted; undefined when the visit never reached the provider or wasn't tracked.
  timeWithProviderMinutes?: number;
  // Charted codes — present only when the request set includeCodes.
  // ICD-10 diagnosis codes on the encounter; the primary diagnosis (rank 1) is first when marked.
  icdCodes?: string[];
  // CPT billing/procedure codes charted on the visit (excludes the E&M code).
  cptCodes?: string[];
  // The visit's E&M code (e.g. 99213), if set.
  emCode?: string;
}

export interface IncompleteEncountersReportZambdaOutput {
  message: string;
  encounters: IncompleteEncounterItem[];
}
