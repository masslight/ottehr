import { DeleteOutlined as DeleteIcon, EditOutlined as EditIcon } from '@mui/icons-material';
import { Box, CircularProgress, IconButton, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useState } from 'react';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import { BoxStyled } from 'src/features/visits/shared/components/generic-notes-list/components/ui/BoxStyled';
import { PatientNoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { useDeletePatientNote } from '../hooks/useDeletePatientNote';
import { noteKind, NoteTarget } from '../hooks/usePatientNotes';
import { EditPatientNoteModal } from './EditPatientNoteModal';

interface PatientNoteItemProps {
  note: PatientNoteDTO;
  target: NoteTarget;
}

/** "<time written> by <author>", then who else edited it, or "(edited)" when only the author did. */
export const formatNoteByline = (note: PatientNoteDTO): string => {
  const written = note.sent ?? note.lastUpdated;
  const date = written ? DateTime.fromISO(written).toFormat('MM/dd/yyyy hh:mm a') : '';
  const editors = note.editorNames?.length ? `, edited by ${note.editorNames.join(', ')}` : '';
  return `${date} by ${note.authorName || note.authorId}${editors || (note.edited ? ' (edited)' : '')}`;
};

export const PatientNoteItem: React.FC<PatientNoteItemProps> = ({ note, target }) => {
  const theme = useTheme();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const { mutateAsync: deleteNote, isPending: isDeleting } = useDeletePatientNote();

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
            {formatNoteByline(note)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', py: 1, gap: 0.5 }}>
          <IconButton
            size="small"
            aria-label="edit note"
            sx={{ color: theme.palette.primary.dark }}
            onClick={() => setIsEditOpen(true)}
            disabled={isDeleting}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label="delete note"
            sx={{ color: theme.palette.error.main }}
            onClick={() => setIsDeleteOpen(true)}
            disabled={isDeleting}
          >
            {isDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon fontSize="small" />}
          </IconButton>
        </Box>
      </BoxStyled>

      {isEditOpen && <EditPatientNoteModal note={note} target={target} onClose={() => setIsEditOpen(false)} />}

      <InPersonModal
        open={isDeleteOpen}
        handleClose={() => setIsDeleteOpen(false)}
        title={`Delete ${noteKind(target)} note`}
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
