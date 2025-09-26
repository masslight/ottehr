export interface VisitsOverviewReportZambdaInput {
  dateRange: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
}

export interface AppointmentTypeCount {
  type: 'In-Person' | 'Telemed' | 'Unknown';
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

export interface VisitsOverviewReportZambdaOutput {
  message: string;
  totalAppointments: number;
  appointmentTypes: AppointmentTypeCount[];
  dailyVisits: DailyVisitCount[];
  dateRange: {
    start: string;
    end: string;
  };
}
