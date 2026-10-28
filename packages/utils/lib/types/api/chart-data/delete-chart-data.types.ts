import { AllChartValues, SchoolWorkNoteExcuseDocFileDTO } from './chart-data.types';

export interface DeleteChartDataRequest extends AllChartValues {
  encounterId: string;
  cleanupProcedureDiagnoses?: boolean;
  schoolWorkNotes?: SchoolWorkNoteExcuseDocFileDTO[];
}

export interface DeleteChartDataResponse {
  patientId: string;
}
