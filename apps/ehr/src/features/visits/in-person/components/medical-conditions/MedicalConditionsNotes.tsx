import { defaultNoteLocales } from 'src/features/visits/shared/components/generic-notes-list/default-note-locales.helper';
import { GenericNoteList } from 'src/features/visits/shared/components/generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from 'src/features/visits/shared/components/generic-notes-list/types';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';

const medicalConditionsNotesConfig: GenericNotesConfig = {
  apiConfig: {
    type: NOTE_TYPE.MEDICAL_CONDITION,
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
