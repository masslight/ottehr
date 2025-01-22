import {
  ChartDataFields,
  PATIENT_VITALS_META_SYSTEM,
  PRIVATE_EXTENSION_BASE_URL,
  SearchParams,
  VitalFieldNames,
} from 'utils';

export interface VitalsSearchConfig {
  fieldName: Extract<keyof ChartDataFields, 'vitalsObservations'>;
  vitalFiledName: VitalFieldNames;
  searchParams: SearchParams;
}

export const createVitalsSearchConfig = (
  vitalFieldName: VitalFieldNames,
  searchBy: 'encounter' | 'patient'
): VitalsSearchConfig => {
  return {
    fieldName: 'vitalsObservations',
    vitalFiledName: vitalFieldName,
    searchParams: {
      _search_by: searchBy,
      _include: 'Observation:performer',
      _sort: '-_lastUpdated',
      _count: 100,
      _tag: {
        type: 'token',
        value: `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}|${vitalFieldName}`,
      },
    },
  };
};
