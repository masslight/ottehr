import { ChartDataFields } from './chart-data.types';

export interface DeleteChartDataRequest extends ChartDataFields {
  encounterId: string;
}

export interface DeleteChartDataResponse {
  patientId: string;
}
