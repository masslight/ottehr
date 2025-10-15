import { defaultNoteLocales } from 'src/features/visits/shared/components/generic-notes-list/default-note-locales.helper';
import { GenericNoteList } from 'src/features/visits/shared/components/generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from 'src/features/visits/shared/components/generic-notes-list/types';
import { IN_PERSON_NOTE_ID, NOTE_TYPE, PRIVATE_EXTENSION_BASE_URL } from 'utils';

const hospitalizationNotesConfig: GenericNotesConfig = {
  apiConfig: {
    fieldName: 'notes',
    type: NOTE_TYPE.HOSPITALIZATION,
    searchParams: {
      _sort: '-_lastUpdated',
      _count: 1000,
      _tag: `${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.HOSPITALIZATION}|${IN_PERSON_NOTE_ID}`,
    },
  },
  locales: {
    ...defaultNoteLocales,
    entityLabel: 'hospitalization note',
    editModalTitle: 'Edit Hospitalization Note',
    editModalPlaceholder: 'Hospitalization Note',
  },
};

export const HospitalizationNotes: React.FC = () => (
  <GenericNoteList apiConfig={hospitalizationNotesConfig.apiConfig} locales={hospitalizationNotesConfig.locales} />
);
