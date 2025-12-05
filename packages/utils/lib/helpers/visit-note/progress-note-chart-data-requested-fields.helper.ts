import { PRIVATE_EXTENSION_BASE_URL, SearchParams } from '../../fhir';
import { ChartDataRequestedFields, IN_PERSON_NOTE_ID } from '../../types';
import { VitalFieldNames } from '../../types/api/chart-data/chart-data.constants';
import { NOTE_TYPE } from '../../types/api/chart-data/chart-data.types';
import { createVitalsSearchConfig } from './create-vitals-search-config.helper';

export const vitalsObservationsRequest: SearchParams = {
  _search_by: 'encounter',
  _sort: '-_lastUpdated',
  _count: 100,
  _tag: Object.values(VitalFieldNames)
    .map((name) => (createVitalsSearchConfig(name, 'encounter').searchParams as { _tag: string })._tag)
    .join(','),
};

export const progressNoteChartDataRequestedFields: ChartDataRequestedFields = {
  chiefComplaint: { _tag: 'chief-complaint' },
  mechanismOfInjury: { _tag: 'mechanism-of-injury' },
  historyOfPresentIllness: { _tag: 'history-of-present-illness' },
  ros: { _tag: 'ros' },
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
      .map((note) => `${PRIVATE_EXTENSION_BASE_URL}/${note}|${IN_PERSON_NOTE_ID}`)
      .join(','),
  },
  vitalsObservations: vitalsObservationsRequest,
  externalLabResults: {},
  inHouseLabResults: {},
  practitioners: {},
  medicalDecision: {
    _tag: 'medical-decision',
  },
};

export const telemedProgressNoteChartDataRequestedFields: ChartDataRequestedFields = {
  chiefComplaint: { _tag: 'chief-complaint' },
  ros: { _tag: 'ros' },
  prescribedMedications: {},
  disposition: {},
  medicalDecision: {
    _tag: 'medical-decision',
  },
  surgicalHistoryNote: {
    _tag: 'surgical-history-note',
  },
  vitalsObservations: vitalsObservationsRequest,
};
