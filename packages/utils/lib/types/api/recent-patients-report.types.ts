export interface RecentPatientsReportZambdaInput {
  dateRange: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
  locationId?: string; // Optional filter by location
}

export interface RecentPatientRecord {
  patientId: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  mostRecentVisit: {
    appointmentId: string;
    date: string; // ISO date string
    serviceCategory: string; // e.g., "General Care", "Urgent Care", etc.
  };
  patientStatus: 'new' | 'existing'; // New or existing patient based on visit history
}

export interface RecentPatientsReportZambdaOutput {
  message: string;
  totalPatients: number;
  patients: RecentPatientRecord[];
  dateRange: {
    start: string;
    end: string;
  };
  locationId?: string;
}
