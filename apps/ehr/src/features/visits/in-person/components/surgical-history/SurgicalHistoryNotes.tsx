import { dataTestIds } from 'src/constants/data-test-ids';
import { defaultNoteLocales } from 'src/features/visits/shared/components/generic-notes-list/default-note-locales.helper';
import { GenericNoteList } from 'src/features/visits/shared/components/generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from 'src/features/visits/shared/components/generic-notes-list/types';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';

const surgicalHistoryNotesConfig: GenericNotesConfig = {
  apiConfig: {
    type: NOTE_TYPE.SURGICAL_HISTORY,
  },
  locales: {
    ...defaultNoteLocales,
    entityLabel: 'surgical history note',
    editModalTitle: 'Edit Surgical History Note',
    editModalPlaceholder: 'Surgical History Note',
  },
};

export const SurgicalHistoryNotes: React.FC = () => (
  <GenericNoteList
    apiConfig={surgicalHistoryNotesConfig.apiConfig}
    locales={surgicalHistoryNotesConfig.locales}
    addNoteButtonDataTestId={dataTestIds.telemedEhrFlow.hpiSurgicalHistoryAddNoteButton}
    noteLoadingIndicatorDataTestId={dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNoteIsLoading}
  />
);
