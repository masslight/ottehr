import { DeleteOutlined as DeleteIcon, EditOutlined as EditIcon } from '@mui/icons-material';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useState } from 'react';
import { EditableNote, NoteLocales } from '../types';
import { DeleteNoteModal } from './DeleteNoteModal';
import { EditNoteModal } from './EditNoteModal';
import { BoxStyled } from './ui/BoxStyled';

export const NoteEntity: React.FC<{
  entity: EditableNote;
  onEdit: (entity: EditableNote, newText: string) => Promise<void>;
  onDelete: (entity: EditableNote) => Promise<void>;
  locales: NoteLocales;
}> = ({ entity, onEdit, onDelete, locales }) => {
  const theme = useTheme();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleDeleteClick = (): void => {
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = (): void => {
    setIsDeleteModalOpen(false);
  };

  const openEditModal = (): void => setIsEditModalOpen(true);
  const closeEditModal = (): void => setIsEditModalOpen(false);

  return (
    <>
      <BoxStyled>
        <Box sx={{ py: 1, pr: 4 }}>
          <Typography variant="body1">{entity.text}</Typography>
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
            {entity.lastUpdated ? DateTime.fromISO(entity.lastUpdated).toFormat('MM/dd/yyyy HH:mm a') : ''} by{' '}
            {entity.authorName || entity.authorId}
          </Typography>
        </Box>
        <Box sx={{ minWidth: '72px', py: 1 }}>
          <IconButton size="small" aria-label="edit" sx={{ color: theme.palette.primary.dark }}>
            <EditIcon fontSize="small" onClick={openEditModal} />
          </IconButton>
          <IconButton
            size="small"
            aria-label="delete"
            sx={{ color: theme.palette.warning.dark }}
            onClick={handleDeleteClick}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      </BoxStyled>

      <DeleteNoteModal
        open={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        entity={entity}
        onDelete={onDelete}
        locales={locales}
      />

      <EditNoteModal
        open={isEditModalOpen}
        onClose={closeEditModal}
        entity={entity}
        onEdit={onEdit}
        locales={locales}
      />
    </>
  );
};
