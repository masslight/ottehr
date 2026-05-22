import { DeleteOutlined as DeleteIcon, EditOutlined as EditIcon } from '@mui/icons-material';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { EditableNote, NoteLocales } from '../types';
import { DeleteNoteModal } from './DeleteNoteModal';
import { EditNoteModal } from './EditNoteModal';
import { BoxStyled } from './ui/BoxStyled';

export const NoteEntity: React.FC<{
  entity: EditableNote;
  onEdit: (entity: EditableNote, newText: string) => Promise<void>;
  onDelete: (entity: EditableNote) => Promise<void>;
  locales: NoteLocales;
  isReadOnly: boolean;
  ownerOnly?: boolean;
  showEditedMarker?: boolean;
  softDeleteWithTombstone?: boolean;
  currentPractitionerId?: string;
}> = ({
  entity,
  onEdit,
  onDelete,
  locales,
  isReadOnly,
  ownerOnly,
  showEditedMarker,
  softDeleteWithTombstone,
  currentPractitionerId,
}) => {
  const theme = useTheme();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const isDeleted = !!entity.deleted;
  const isOwn = !ownerOnly || (!!currentPractitionerId && entity.authorId === currentPractitionerId);
  const showButtons = !isReadOnly && isOwn && !isDeleted;
  const edited = !isDeleted && !!showEditedMarker && !!entity.edited;

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
      <BoxStyled dataTestId={dataTestIds.screeningPage.screeningNoteItem}>
        <Box sx={{ py: 1, pr: 4 }}>
          {isDeleted && softDeleteWithTombstone ? (
            <Typography variant="caption" color="textSecondary">
              {entity.lastUpdated ? DateTime.fromISO(entity.lastUpdated).toFormat('MM/dd/yyyy hh:mm a') : ''}{' '}
              {entity.authorName || entity.authorId} deleted the note
            </Typography>
          ) : (
            <>
              <Typography variant="body1">{entity.text}</Typography>
              <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                {entity.lastUpdated ? DateTime.fromISO(entity.lastUpdated).toFormat('MM/dd/yyyy hh:mm a') : ''} by{' '}
                {entity.authorName || entity.authorId}
                {edited ? ' (edited)' : ''}
              </Typography>
            </>
          )}
        </Box>
        {showButtons && (
          <Box sx={{ minWidth: '72px', py: 1 }}>
            <IconButton
              size="small"
              aria-label="edit"
              sx={{ color: theme.palette.primary.dark }}
              onClick={openEditModal}
            >
              <EditIcon fontSize="small" />
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
        )}
      </BoxStyled>

      <DeleteNoteModal
        open={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        entity={entity}
        onDelete={onDelete}
        locales={locales}
      />
      {isEditModalOpen && <EditNoteModal onClose={closeEditModal} entity={entity} onEdit={onEdit} locales={locales} />}
    </>
  );
};
