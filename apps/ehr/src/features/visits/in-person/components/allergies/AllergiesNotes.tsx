import { defaultNoteLocales } from 'src/features/visits/shared/components/generic-notes-list/default-note-locales.helper';
import { GenericNoteList } from 'src/features/visits/shared/components/generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from 'src/features/visits/shared/components/generic-notes-list/types';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';

const allergiesNotesConfig: GenericNotesConfig = {
  apiConfig: {
    type: NOTE_TYPE.ALLERGY,
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
