import {
  ChartDataFields,
  PATIENT_VITALS_META_SYSTEM,
  PRIVATE_EXTENSION_BASE_URL,
  SearchParams,
  VitalFieldNames,
} from 'utils';

export interface VitalsSearchConfig {
  fieldName: Extract<keyof ChartDataFields, 'vitalsObservations'>;
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
      _tag: `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}|${vitalFieldName}`,
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
