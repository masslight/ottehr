import { ChartDataFields } from './chart-data.types';

export interface GetChartDataRequest {
  encounterId: string;
}

export interface GetChartDataResponse extends ChartDataFields {
  patientId: string;
}
