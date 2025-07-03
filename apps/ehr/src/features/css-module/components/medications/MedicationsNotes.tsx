import { CSS_NOTE_ID, NOTE_TYPE, PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { defaultNoteLocales } from '../generic-notes-list/default-note-locales.helper';
import { GenericNoteList } from '../generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from '../generic-notes-list/types';

const medicationsNotesConfig: GenericNotesConfig = {
  apiConfig: {
    fieldName: 'notes',
    type: NOTE_TYPE.INTAKE_MEDICATION,
    searchParams: {
      _sort: '-_lastUpdated',
      _count: 1000,
      _tag: `${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.INTAKE_MEDICATION}|${CSS_NOTE_ID}`,
    },
  },
  locales: {
    ...defaultNoteLocales,
    entityLabel: 'medication note',
    editModalTitle: 'Edit Medication Note',
    editModalPlaceholder: 'Medication Note',
  },
};

export const MedicationsNotes: React.FC = () => (
  <GenericNoteList apiConfig={medicationsNotesConfig.apiConfig} locales={medicationsNotesConfig.locales} />
);
