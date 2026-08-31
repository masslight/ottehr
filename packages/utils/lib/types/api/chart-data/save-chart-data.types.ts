// cSpell:ignore abletobearweight, decreasedrom, lowerleg, upperarm
import { CodeableConcept } from 'fhir/r4b';
import {
  AllChartValues,
  ChartDataWithResources,
  SchoolWorkNoteExcuseDocDTO,
  SchoolWorkNoteExcuseDocFileDTO,
} from './chart-data.types';

export interface SaveChartDataRequest extends AllChartValues {
  encounterId: string;
  /**
   * for the examObservations property
   * chained checkboxes must be provided all at once
   * For example:
   * Calm and Fussy
   * if calm is true - front mush send Fussy = false AND Calm = true
   */
  newSchoolWorkNote?: SchoolWorkNoteExcuseDocDTO;
  schoolWorkNotes?: Pick<SchoolWorkNoteExcuseDocFileDTO, 'id' | 'published'>[];
}

export type SaveChartDataResponse = ChartDataWithResources;

export type SNOMEDCodeInterface = CodeableConcept;
export interface SNOMEDCodeConceptInterface {
  bodySite?: SNOMEDCodeInterface;
  // we use 'SNOMED note' as code if it's provided, and if not we use main code
  // SNOMED codes map: https://docs.google.com/spreadsheets/d/1Ggi4lYVoh-nT5XIKlWNJDUPipQ0OOgvSqoHHxziIgAE/edit#gid=0
  code: SNOMEDCodeInterface;
}
