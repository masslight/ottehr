import { ChartDataFields, WorkSchoolNoteExcuseDocFileDTO } from './chart-data.types';

export interface DeleteChartDataRequest extends ChartDataFields {
  encounterId: string;
  workSchoolNotes?: WorkSchoolNoteExcuseDocFileDTO[];
}

export interface DeleteChartDataResponse {
  patientId: string;
}
