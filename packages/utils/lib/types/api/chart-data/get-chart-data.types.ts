import { Practitioner } from 'fhir/r4b';
import { AllChartValues, PharmacyDTO, SchoolWorkNoteExcuseDocFileDTO } from './chart-data.types';

/**
 * The whole-chart shape: every chart list plus the visit's single-valued fields. The EHR's `useChartData`
 * and the PDF composers read the chart in this shape, assembled from a visit note
 * (visitNoteToLegacyChartData).
 */
export interface GetChartDataResponse extends AllChartValues {
  patientId: string;
  patientHasPreviousVisits?: boolean;
  schoolWorkNotes?: SchoolWorkNoteExcuseDocFileDTO[];
  practitioners?: Practitioner[];
  preferredPharmacies?: PharmacyDTO[];
}
