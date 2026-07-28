// Import from specific sibling modules rather than the package barrel ('utils').
// This file's export is consumed at module top-level by
// progress-note-chart-data-requested-fields.helper.ts; importing the root barrel
// here creates a barrel → sibling → barrel cycle that leaves
// `createVitalsSearchConfig` undefined at init time depending on bundling order.
import { PRIVATE_EXTENSION_BASE_URL, SearchParams } from '../../fhir';
import { VitalFieldNames } from '../../types/api/chart-data/chart-data.constants';
import { AllChartValues, PATIENT_VITALS_META_SYSTEM } from '../../types/api/chart-data/chart-data.types';

export interface VitalsSearchConfig {
  fieldName: Extract<keyof AllChartValues, 'vitalsObservations'>;
  searchParams: SearchParams;
}

export const createVitalsSearchConfig = (
  vitalFieldName: VitalFieldNames,
  searchBy: 'encounter' | 'patient',
  count?: number
): VitalsSearchConfig => {
  return {
    fieldName: 'vitalsObservations',
    searchParams: {
      _search_by: searchBy,
      _include: 'Observation:performer',
      _sort: '-_lastUpdated',
      _count: count ?? 100,
      _tag: vitalFieldName,
    },
  };
};

export const allVitalsSearchConfigForEncounter = (count?: number): VitalsSearchConfig => {
  return {
    fieldName: 'vitalsObservations',
    searchParams: {
      _search_by: 'encounter',
      _include: 'Observation:performer',
      _sort: '-_lastUpdated',
      _count: count ?? 1000,
      _tag: `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}|`,
    },
  };
};
