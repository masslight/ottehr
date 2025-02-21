import { PRIVATE_EXTENSION_BASE_URL } from '../../fhir';
import { ChartDataRequestedFields, CSS_NOTE_ID, NOTE_TYPE, VitalFieldNames } from '../../types';
import { createVitalsSearchConfig } from './create-vitals-search-config.helper';

export const progressNoteChartDataRequestedFields: ChartDataRequestedFields = {
  episodeOfCare: {},
  prescribedMedications: {},
  notes: {
    _sort: '-_lastUpdated',
    _count: 1000,
    _tag: {
      type: 'token',
      value: `${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.SCREENING}|${CSS_NOTE_ID},${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.VITALS}|${CSS_NOTE_ID}`,
    },
  },
  vitalsObservations: {
    _search_by: 'encounter',
    _sort: '-_lastUpdated',
    _count: 100,
    _tag: {
      type: 'token',
      value: Object.values(VitalFieldNames)
        .map(
          (name) =>
            (createVitalsSearchConfig(name, 'encounter').searchParams as { _tag: { type: string; value: string } })._tag
              .value
        )
        .join(','),
    },
  },
};

export const telemedProgressNoteChartDataRequestedFields: ChartDataRequestedFields = {
  prescribedMedications: {},
};
