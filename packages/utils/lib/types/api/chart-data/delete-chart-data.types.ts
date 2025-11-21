import { AllChartValues, SchoolWorkNoteExcuseDocFileDTO } from './chart-data.types';

export interface DeleteChartDataRequest extends AllChartValues {
  encounterId: string;
  schoolWorkNotes?: SchoolWorkNoteExcuseDocFileDTO[];
}

export interface DeleteChartDataResponse {
  patientId: string;
}
