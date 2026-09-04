import { DeleteOutlined as DeleteIcon, EditOutlined as EditIcon } from '@mui/icons-material';
import { Box, CircularProgress, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useState } from 'react';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import { BoxStyled } from 'src/features/visits/shared/components/generic-notes-list/components/ui/BoxStyled';
import { PatientNoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { useDeletePatientNote } from '../hooks/useDeletePatientNote';
import { EditPatientNoteModal } from './EditPatientNoteModal';

interface PatientNoteItemProps {
  note: PatientNoteDTO;
}

export const PatientNoteItem: React.FC<PatientNoteItemProps> = ({ note }) => {
  const theme = useTheme();
  const user = useEvolveUser();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const { mutateAsync: deleteNote, isPending: isDeleting } = useDeletePatientNote(note.patientId);

  const currentUserId = user?.profile?.split('/')?.[1];
  const canEdit = Boolean(currentUserId && currentUserId === note.authorId);

  const formattedDate = note.lastUpdated ? DateTime.fromISO(note.lastUpdated).toFormat('MM/dd/yyyy hh:mm a') : '';

  const handleDelete = async (entity: PatientNoteDTO): Promise<void> => {
    if (!entity.resourceId) return;
    await deleteNote(entity.resourceId);
  };

  return (
    <>
      <BoxStyled>
        <Box sx={{ py: 1, pr: 4 }}>
          <Typography variant="body1" whiteSpace="pre-wrap">
            {note.text}
          </Typography>
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
            {formattedDate} by {note.authorName || note.authorId}
            {note.edited ? ' (edited)' : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', py: 1, gap: 0.5 }}>
          <Tooltip title={!canEdit ? 'Only the author can edit this note' : ''}>
            <span>
              <IconButton
                size="small"
                aria-label="edit note"
                sx={{ color: theme.palette.primary.dark }}
                onClick={() => setIsEditOpen(true)}
                disabled={!canEdit || isDeleting}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={!canEdit ? 'Only the author can delete this note' : ''}>
            <span>
              <IconButton
                size="small"
                aria-label="delete note"
                sx={{ color: theme.palette.error.main }}
                onClick={() => setIsDeleteOpen(true)}
                disabled={!canEdit || isDeleting}
              >
                {isDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </BoxStyled>

      {isEditOpen && <EditPatientNoteModal note={note} onClose={() => setIsEditOpen(false)} />}

      <InPersonModal
        open={isDeleteOpen}
        handleClose={() => setIsDeleteOpen(false)}
        title="Delete patient note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        entity={note}
        handleConfirm={handleDelete}
        getEntityPreviewText={(n) => n.text}
        closeButtonText="Keep"
        confirmText="Delete"
        errorMessage="Failed to delete note. Please try again."
      />
    </>
  );
};
