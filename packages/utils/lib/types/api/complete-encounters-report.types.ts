export interface CompleteEncountersReportZambdaInput {
  dateRange: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
}

export interface CompleteEncounterItem {
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

export interface CompleteEncountersReportZambdaOutput {
  message: string;
  encounters: CompleteEncounterItem[];
}
