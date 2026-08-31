import { Practitioner } from 'fhir/r4b';
import { SearchParams } from '../../../fhir/uri';
import { AllChartValues, PharmacyDTO, RequestedFields, SchoolWorkNoteExcuseDocFileDTO } from './chart-data.types';

export interface GetChartDataRequest {
  encounterId: string;
  requestedFields?: ChartDataRequestedFields;
}

export interface GetChartDataResponse extends AllChartValues {
  patientId: string;
  patientHasPreviousVisits?: boolean;
  schoolWorkNotes?: SchoolWorkNoteExcuseDocFileDTO[];
  practitioners?: Practitioner[];
  preferredPharmacies?: PharmacyDTO[];
}

export type ChartDataRequestedFields = Partial<Record<RequestedFields, SearchParams>>;
