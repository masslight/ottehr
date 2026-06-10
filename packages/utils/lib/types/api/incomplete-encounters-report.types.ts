export type EncounterStatusFilter = 'incomplete' | 'complete' | 'all';

export interface IncompleteEncountersReportZambdaInput {
  dateRange: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
  encounterStatus?: EncounterStatusFilter; // defaults to 'incomplete'
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
}

export interface IncompleteEncountersReportZambdaOutput {
  message: string;
  encounters: IncompleteEncounterItem[];
}
