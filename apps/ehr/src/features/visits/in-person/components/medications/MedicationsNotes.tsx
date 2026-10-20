import { dataTestIds } from 'src/constants/data-test-ids';
import { defaultNoteLocales } from 'src/features/visits/shared/components/generic-notes-list/default-note-locales.helper';
import { GenericNoteList } from 'src/features/visits/shared/components/generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from 'src/features/visits/shared/components/generic-notes-list/types';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';

const medicationsNotesConfig: GenericNotesConfig = {
  apiConfig: {
    type: NOTE_TYPE.INTAKE_MEDICATION,
  },
  locales: {
    ...defaultNoteLocales,
    entityLabel: 'medication note',
    editModalTitle: 'Edit Medication Note',
    editModalPlaceholder: 'Medication Note',
  },
};

export const MedicationsNotes: React.FC = () => (
  <GenericNoteList
    apiConfig={medicationsNotesConfig.apiConfig}
    locales={medicationsNotesConfig.locales}
    addNoteButtonDataTestId={dataTestIds.medicationsPage.addNoteButton}
  />
);
