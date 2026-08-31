import { EditOutlined as EditIcon } from '@mui/icons-material';
import { Box, Chip, IconButton, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useState } from 'react';
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
      <Box
        sx={{
          py: 1.5,
          px: 2,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          position: 'relative',
        }}
      >
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 0.5 }}>
          {note.text}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            {formattedDate} by {note.authorName || note.authorId}
          </Typography>
          {note.edited && (
            <Chip label="edited" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.65rem' }} />
          )}
        </Box>
        {canEdit && (
          <IconButton
            size="small"
            aria-label="edit note"
            onClick={() => setIsEditOpen(true)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              color: theme.palette.primary.dark,
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {isEditOpen && <EditPatientNoteModal note={note} onClose={() => setIsEditOpen(false)} />}
    </>
  );
};
