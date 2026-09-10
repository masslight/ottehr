import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useVisitNote } from '../../hooks/useVisitNote';
import { BoxStyled } from '../generic-notes-list/components/ui/BoxStyled';
import { defaultNoteLocales } from '../generic-notes-list/default-note-locales.helper';
import { GenericNoteList } from '../generic-notes-list/GenericNoteList';
import { GenericNotesConfig } from '../generic-notes-list/types';

const addendumNotesConfig: GenericNotesConfig = {
  apiConfig: {
    type: NOTE_TYPE.ADDENDUM,
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
  const { data: note } = useVisitNote();
  const legacyAddendumText = note?.encounterNotes.addendumNote?.text;

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
