export interface VisitsOverviewReportZambdaInput {
  dateRange: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
}

export interface AppointmentTypeCount {
  type: 'In-Person' | 'Telemed';
  count: number;
  percentage: number;
}

export interface DailyVisitCount {
  date: string; // YYYY-MM-DD format
  inPerson: number;
  telemed: number;
  unknown: number;
  total: number;
}

export interface LocationVisitCount {
  locationName: string;
  locationId: string;
  inPerson: number;
  telemed: number;
  total: number;
}

export interface PractitionerVisitCount {
  practitionerId: string;
  practitionerName: string;
  role: 'Attending Provider' | 'Intake Performer';
  inPerson: number;
  telemed: number;
  total: number;
}

export interface VisitsOverviewReportZambdaOutput {
  message: string;
  totalAppointments: number;
  appointmentTypes: AppointmentTypeCount[];
  dailyVisits: DailyVisitCount[];
  locationVisits: LocationVisitCount[];
  practitionerVisits: PractitionerVisitCount[];
  dateRange: {
    start: string;
    end: string;
  };
}
