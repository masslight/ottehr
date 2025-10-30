export interface AiAssistedEncountersReportZambdaInput {
  dateRange: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
  locationIds?: string[]; // Optional array of location IDs to filter by
}

export interface AiAssistedEncounterItem {
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
  aiType?: string; // AI type: 'patient HPI chatbot', 'ambient scribe', or 'patient HPI chatbot & ambient scribe'
}

export interface AiAssistedEncountersReportZambdaOutput {
  message: string;
  encounters: AiAssistedEncounterItem[];
}
