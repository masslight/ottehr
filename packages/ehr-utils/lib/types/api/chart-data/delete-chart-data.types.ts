import { ChartDataFields, SchoolWorkNoteExcuseDocFileDTO } from './chart-data.types';

export interface DeleteChartDataRequest extends ChartDataFields {
  encounterId: string;
  schoolWorkNotes?: SchoolWorkNoteExcuseDocFileDTO[];
}

export interface DeleteChartDataResponse {
  patientId: string;
}
