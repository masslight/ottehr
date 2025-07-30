import { PRIVATE_EXTENSION_BASE_URL } from '../../fhir';
import { ChartDataRequestedFields, CSS_NOTE_ID, NOTE_TYPE, VitalFieldNames } from '../../types';
import { createVitalsSearchConfig } from './create-vitals-search-config.helper';

export const getProgressNoteChartDataRequestedFields = (): ChartDataRequestedFields => ({
  episodeOfCare: {},
  prescribedMedications: {},
  disposition: {},
  notes: {
    _sort: '-_lastUpdated',
    _count: 1000,
    _tag: [
      NOTE_TYPE.SCREENING,
      NOTE_TYPE.VITALS,
      NOTE_TYPE.INTAKE,
      NOTE_TYPE.ALLERGY,
      NOTE_TYPE.INTAKE_MEDICATION,
      NOTE_TYPE.HOSPITALIZATION,
      NOTE_TYPE.MEDICAL_CONDITION,
      NOTE_TYPE.SURGICAL_HISTORY,
      NOTE_TYPE.MEDICATION,
    ]
      .map((note) => `${PRIVATE_EXTENSION_BASE_URL}/${note}|${CSS_NOTE_ID}`)
      .join(','),
  },
  vitalsObservations: {
    _search_by: 'encounter',
    _sort: '-_lastUpdated',
    _count: 100,
    _tag: Object.values(VitalFieldNames)
      .map((name) => (createVitalsSearchConfig(name, 'encounter').searchParams as { _tag: string })._tag)
      .join(','),
  },
  externalLabResults: {},
  inHouseLabResults: {},
  practitioners: {},
});

export const telemedProgressNoteChartDataRequestedFields: ChartDataRequestedFields = {
  prescribedMedications: {},
  disposition: {},
};
