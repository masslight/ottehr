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
    _tag: `${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.SCREENING}|${CSS_NOTE_ID},${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.VITALS}|${CSS_NOTE_ID},${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.INTAKE}|${CSS_NOTE_ID}`,
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
});

export const telemedProgressNoteChartDataRequestedFields: ChartDataRequestedFields = {
  prescribedMedications: {},
  disposition: {},
};
