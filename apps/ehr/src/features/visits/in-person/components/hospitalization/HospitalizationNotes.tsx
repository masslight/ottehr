import { dataTestIds } from 'src/constants/data-test-ids';
import { defaultNoteLocales } from 'src/features/visits/shared/components/generic-notes-list/default-note-locales.helper';
import { GenericNoteList } from 'src/features/visits/shared/components/generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from 'src/features/visits/shared/components/generic-notes-list/types';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';

const hospitalizationNotesConfig: GenericNotesConfig = {
  apiConfig: {
    type: NOTE_TYPE.HOSPITALIZATION,
  },
  locales: {
    ...defaultNoteLocales,
    entityLabel: 'hospitalization note',
    editModalTitle: 'Edit Hospitalization Note',
    editModalPlaceholder: 'Hospitalization Note',
  },
};

export const HospitalizationNotes: React.FC = () => (
  <GenericNoteList
    addNoteButtonDataTestId={dataTestIds.hospitalizationPage.addNoteButton}
    apiConfig={hospitalizationNotesConfig.apiConfig}
    locales={hospitalizationNotesConfig.locales}
  />
);
