import { CSS_NOTE_ID, NOTE_TYPE, PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { defaultNoteLocales } from '../generic-notes-list/default-note-locales.helper';
import { GenericNoteList } from '../generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from '../generic-notes-list/types';

const allergiesNotesConfig: GenericNotesConfig = {
  apiConfig: {
    fieldName: 'notes',
    type: NOTE_TYPE.ALLERGY,
    searchParams: {
      _sort: '-_lastUpdated',
      _count: 1000,
      _tag: `${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.ALLERGY}|${CSS_NOTE_ID}`,
    },
  },
  locales: {
    ...defaultNoteLocales,
    entityLabel: 'allergy note',
    editModalTitle: 'Edit Allergy Note',
    editModalPlaceholder: 'Allergy Note',
  },
};

export const AllergiesNotes: React.FC = () => (
  <GenericNoteList apiConfig={allergiesNotesConfig.apiConfig} locales={allergiesNotesConfig.locales} />
);
