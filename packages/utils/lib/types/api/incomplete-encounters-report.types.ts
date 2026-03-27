export type EncounterStatusFilter = 'incomplete' | 'complete';

export interface IncompleteEncountersReportZambdaInput {
  dateRange: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
  encounterStatus?: EncounterStatusFilter; // defaults to 'incomplete'
  includeEmCodes?: boolean; // when true, fetches E&M codes for each encounter
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
  emCode?: string; // E&M code (e.g., '99203', '99214')
  providerToDischargedMinutes?: number | null; // time from provider status to discharged in minutes
}

export interface IncompleteEncountersReportZambdaOutput {
  message: string;
  encounters: IncompleteEncounterItem[];
}
