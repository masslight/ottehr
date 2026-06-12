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
  // Number of radiology orders on this encounter that have actually been transmitted to a
  // teleradiology group for an external read (i.e. carry the has-been-sent-to-teleradiology
  // extension). Usually 0 or 1, but can be higher when multiple orders were sent.
  teleradiologyOrdersSent: number;
}

export interface IncompleteEncountersReportZambdaOutput {
  message: string;
  encounters: IncompleteEncounterItem[];
}
