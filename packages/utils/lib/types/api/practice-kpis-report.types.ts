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
  arrivedToIntakeAverage: number | null; // Average minutes from arrived to intake, null if no visits
  arrivedToIntakeMedian: number | null; // Median minutes from arrived to intake, null if no visits
  readyToIntakeAverage: number | null; // Average minutes from ready to intake, null if no visits
  readyToIntakeMedian: number | null; // Median minutes from ready to intake, null if no visits
  intakeToProviderAverage: number | null; // Average minutes from intake to provider, null if no visits
  intakeToProviderMedian: number | null; // Median minutes from intake to provider, null if no visits
  arrivedToProviderAverage: number | null; // Average minutes from arrived to provider, null if no visits
  arrivedToProviderMedian: number | null; // Median minutes from arrived to provider, null if no visits
  arrivedToProviderUnder15Percent: number | null; // Percentage of visits with arrived to provider < 15 min, null if no visits
  arrivedToProviderUnder45Percent: number | null; // Percentage of visits with arrived to provider < 45 min, null if no visits
  providerToDischargedAverage: number | null; // Average minutes from provider to discharged, null if no visits
  providerToDischargedMedian: number | null; // Median minutes from provider to discharged, null if no visits
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
