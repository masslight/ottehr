import { EditOutlined as EditIcon } from '@mui/icons-material';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useState } from 'react';
import { BoxStyled } from 'src/features/visits/shared/components/generic-notes-list/components/ui/BoxStyled';
import { PatientNoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { EditPatientNoteModal } from './EditPatientNoteModal';

interface PatientNoteItemProps {
  note: PatientNoteDTO;
}

export const PatientNoteItem: React.FC<PatientNoteItemProps> = ({ note }) => {
  const theme = useTheme();
  const user = useEvolveUser();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const currentUserId = user?.profile?.split('/')?.[1];
  const canEdit = Boolean(currentUserId && currentUserId === note.authorId);

  const formattedDate = note.lastUpdated ? DateTime.fromISO(note.lastUpdated).toFormat('MM/dd/yyyy hh:mm a') : '';

  return (
    <>
      <BoxStyled>
        <Box sx={{ py: 1, pr: 4 }}>
          <Typography variant="body1">{note.text}</Typography>
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
            {formattedDate} by {note.authorName || note.authorId}
            {note.edited ? ' (edited)' : ''}
          </Typography>
        </Box>
        {canEdit && (
          <Box sx={{ minWidth: '72px', py: 1 }}>
            <IconButton
              size="small"
              aria-label="edit note"
              sx={{ color: theme.palette.primary.dark }}
              onClick={() => setIsEditOpen(true)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </BoxStyled>

      {isEditOpen && <EditPatientNoteModal note={note} onClose={() => setIsEditOpen(false)} />}
    </>
  );
};
