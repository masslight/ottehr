import { Practitioner } from 'fhir/r4b';
import { SearchParams } from '../../../fhir';
import { ChartDataFields, SchoolWorkNoteExcuseDocFileDTO } from './chart-data.types';

export interface GetChartDataRequest {
  encounterId: string;
  requestedFields?: ChartDataRequestedFields;
}

export interface GetChartDataResponse extends ChartDataFields {
  patientId: string;
  schoolWorkNotes?: SchoolWorkNoteExcuseDocFileDTO[];
  practitioners?: Practitioner[];
}

export type ChartDataRequestedFields = Partial<Record<keyof GetChartDataResponse, SearchParams>>;

export interface GetVersionedChartDataRequest {
  chartDataAuditEventId: string;
}

export interface GetVersionedChartDataResponse {
  previousChartData: GetChartDataResponse;
  newChartData: GetChartDataResponse;
}
