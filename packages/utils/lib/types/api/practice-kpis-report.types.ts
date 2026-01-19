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
  arrivedToReadyMedian: number | null; // Median minutes in "arrived" status, null if no visits
  arrivedToDischargedAverage: number | null; // Average minutes from arrived to discharged, null if no visits
  arrivedToDischargedMedian: number | null; // Median minutes from arrived to discharged, null if no visits
  timeToIntakeAverage: number | null; // Average minutes from arrived to intake (or later), null if no visits
  timeToIntakeMedian: number | null; // Median minutes from arrived to intake (or later), null if no visits
  timeToProviderAverage: number | null; // Average minutes from arrived to provider (or later), null if no visits
  timeToProviderMedian: number | null; // Median minutes from arrived to provider (or later), null if no visits
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
