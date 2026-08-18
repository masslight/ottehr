import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { IN_PERSON_NOTE_ID, NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
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

export interface AddendumCardProps {
  /**
   * The visit's ids, for a caller with no appointment in the store. The note list needs all three and
   * renders a spinner until it has them, so a page keyed by ENCOUNTER must supply them.
   */
  resources?: { encounterId?: string; appointmentId?: string; patientId?: string };
  /** `plain` drops the AccordionCard chrome, for a surface that supplies its own heading. */
  variant?: 'card' | 'plain';
}

export const AddendumCard: FC<AddendumCardProps> = ({ resources, variant = 'card' }) => {
  // Surface the legacy single-string addendumNote (Encounter extension) so any pre-existing
  // content still appears after the migration to per-author NoteDTO entries.
  const { data: legacyFields } = useChartFields({
    requestedFields: { addendumNote: {} },
    encounterId: resources?.encounterId,
  });
  const legacyAddendumText = legacyFields?.addendumNote?.text;

  const body = (
    <>
      <GenericNoteList
        apiConfig={addendumNotesConfig.apiConfig}
        locales={addendumNotesConfig.locales}
        separateEncounterNotes={false}
        alwaysEditable
        showEditedMarker
        softDeleteWithTombstone
        // `plain` sits inside a surface that already has its own card, so the list's own Paper — elevation
        // 3 plus a box shadow — reads as a second card nested in the first, with a shadow around the input
        // and the Add button. Only the contents belong there.
        containerSx={
          variant === 'plain'
            ? { mt: 0, boxShadow: 'none', backgroundColor: 'transparent', backgroundImage: 'none' }
            : { mt: 0 }
        }
        resources={resources}
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
    </>
  );

  return variant === 'plain' ? body : <AccordionCard label="Addendum">{body}</AccordionCard>;
};
