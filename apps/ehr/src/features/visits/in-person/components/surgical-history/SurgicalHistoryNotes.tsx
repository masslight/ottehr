import { dataTestIds } from 'src/constants/data-test-ids';
import { defaultNoteLocales } from 'src/features/visits/shared/components/generic-notes-list/default-note-locales.helper';
import { GenericNoteList } from 'src/features/visits/shared/components/generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from 'src/features/visits/shared/components/generic-notes-list/types';
import { IN_PERSON_NOTE_ID, NOTE_TYPE, PRIVATE_EXTENSION_BASE_URL } from 'utils';

const surgicalHistoryNotesConfig: GenericNotesConfig = {
  apiConfig: {
    fieldName: 'notes',
    type: NOTE_TYPE.SURGICAL_HISTORY,
    searchParams: {
      _sort: '-_lastUpdated',
      _count: 1000,
      _tag: `${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.SURGICAL_HISTORY}|${IN_PERSON_NOTE_ID}`,
    },
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
