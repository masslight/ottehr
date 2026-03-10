export type EncounterStatusFilter = 'incomplete' | 'complete';

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
}

export interface IncompleteEncountersReportZambdaOutput {
  message: string;
  encounters: IncompleteEncounterItem[];
}
