import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { IN_PERSON_NOTE_ID, NOTE_TYPE, PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { useChartFields } from '../../hooks/useChartFields';
import { BoxStyled } from '../generic-notes-list/components/ui/BoxStyled';
import { defaultNoteLocales } from '../generic-notes-list/default-note-locales.helper';
import { GenericNoteList } from '../generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from '../generic-notes-list/types';

const addendumNotesConfig: GenericNotesConfig = {
  apiConfig: {
    fieldName: 'notes',
    type: NOTE_TYPE.ADDENDUM,
    searchParams: {
      _search_by: 'encounter',
      _sort: '-_lastUpdated',
      _count: 1000,
      _tag: `${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.ADDENDUM}|${IN_PERSON_NOTE_ID}`,
    },
  },
  locales: {
    ...defaultNoteLocales,
    entityLabel: 'addendum',
    editModalTitle: 'Edit Addendum',
    editModalPlaceholder: 'Addendum',
    getAddButtonText: (isSaving: boolean) => (isSaving ? 'Adding...' : 'Add'),
  },
};

export const AddendumCard: FC = () => {
  // Surface the legacy single-string addendumNote (Encounter extension) so any pre-existing
  // content still appears after the migration to per-author NoteDTO entries.
  const { data: legacyFields } = useChartFields({
    requestedFields: { addendumNote: {} },
  });
  const legacyAddendumText = legacyFields?.addendumNote?.text;

  return (
    <AccordionCard label="Addendum">
      <GenericNoteList
        apiConfig={addendumNotesConfig.apiConfig}
        locales={addendumNotesConfig.locales}
        separateEncounterNotes={false}
        alwaysEditable
        showEditedMarker
        softDeleteWithTombstone
        containerSx={{ mt: 0 }}
      />

      {legacyAddendumText && (
        <BoxStyled>
          <Box sx={{ py: 1, pr: 4 }}>
            <Typography variant="body1">{legacyAddendumText}</Typography>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
              Legacy addendum (read-only)
            </Typography>
          </Box>
        </BoxStyled>
      )}
    </AccordionCard>
  );
};
