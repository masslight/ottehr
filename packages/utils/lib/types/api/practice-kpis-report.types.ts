export interface PracticeKpisReportZambdaInput {
  dateRange: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
}

export interface LocationKpiMetrics {
  locationName: string;
  locationId: string;
  arrivedToReadyAverage: number | null; // Average minutes in "arrived" status, null if no visits
  arrivedToDischargedAverage: number | null; // Average minutes from arrived to discharged, null if no visits
  visitCount: number; // Number of discharged in-person visits
}

export interface PracticeKpisReportZambdaOutput {
  message: string;
  locations: LocationKpiMetrics[];
  dateRange: {
    start: string;
    end: string;
  };
}
