import { CSS_NOTE_ID, NOTE_TYPE, PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { defaultNoteLocales } from '../generic-notes-list/default-note-locales.helper';
import { GenericNoteList } from '../generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from '../generic-notes-list/types';

const medicalConditionsNotesConfig: GenericNotesConfig = {
  apiConfig: {
    fieldName: 'notes',
    type: NOTE_TYPE.MEDICAL_CONDITION,
    searchParams: {
      _sort: '-_lastUpdated',
      _count: 1000,
      _tag: `${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.MEDICAL_CONDITION}|${CSS_NOTE_ID}`,
    },
  },
  locales: {
    ...defaultNoteLocales,
    entityLabel: 'medical condition note',
    editModalTitle: 'Edit Medical Condition Note',
    editModalPlaceholder: 'Medical Condition Note',
  },
};

export const MedicalConditionsNotes: React.FC = () => (
  <GenericNoteList apiConfig={medicalConditionsNotesConfig.apiConfig} locales={medicalConditionsNotesConfig.locales} />
);
