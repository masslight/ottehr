import { VitalFieldNames } from '../../types/api/chart-data/chart-data.constants';
import { NOTE_TYPE } from '../../types/api/chart-data/chart-data.types';
import { createVitalsSearchConfig } from './create-vitals-search-config.helper';

/** The note types the in-person visit note shows. */
export const progressNoteNoteTypes: NOTE_TYPE[] = [
  NOTE_TYPE.SCREENING,
  NOTE_TYPE.VITALS,
  NOTE_TYPE.INTAKE,
  NOTE_TYPE.ALLERGY,
  NOTE_TYPE.INTAKE_MEDICATION,
  NOTE_TYPE.HOSPITALIZATION,
  NOTE_TYPE.MEDICAL_CONDITION,
  NOTE_TYPE.SURGICAL_HISTORY,
  NOTE_TYPE.MEDICATION,
  NOTE_TYPE.ADDENDUM,
];

/** The note types the telemed visit note shows. */
export const telemedProgressNoteNoteTypes: NOTE_TYPE[] = [NOTE_TYPE.VITALS, NOTE_TYPE.ADDENDUM];

/** The search the visit note reads the encounter's vitals with: every vital field's tag, newest first. */
export const vitalsObservationsRequest: { _sort: string; _count: number; _tag: string } = {
  _sort: '-_lastUpdated',
  _count: 100,
  _tag: Object.values(VitalFieldNames)
    .map((name) => (createVitalsSearchConfig(name, 'encounter').searchParams as { _tag: string })._tag)
    .join(','),
};
