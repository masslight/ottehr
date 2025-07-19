import { DeleteOutlined as DeleteIcon } from '@mui/icons-material';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import React, { JSX, useState } from 'react';
import { kgToLbs, VitalsObservationDTO, VitalsWeightObservationDTO } from 'utils';
import { DeleteVitalModal } from '../DeleteVitalModal';

type VitalWeightHistoryElementProps = {
  historyEntry: VitalsWeightObservationDTO;
  isAlert?: boolean;
  isDeletable?: boolean;
  onDelete: (entity: VitalsObservationDTO) => Promise<void>;
};

export const VitalWeightHistoryElement: React.FC<VitalWeightHistoryElementProps> = ({
  historyEntry,
  isDeletable = false,
  onDelete,
}): JSX.Element => {
  const theme = useTheme();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const handleDeleteClick = (): void => {
    setIsDeleteModalOpen(true);
  };
  const handleCloseDeleteModal = (): void => {
    setIsDeleteModalOpen(false);
  };

  const hasAuthor = !!historyEntry.authorName && historyEntry.authorName.length > 0;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography color="textPrimary">
          {historyEntry.lastUpdated} {hasAuthor && 'by'} {historyEntry.authorName} - &nbsp;
          <Typography component="span" sx={{ fontWeight: 'bold' }}>
            {historyEntry.value} kg &nbsp;
          </Typography>
          <Typography component="span">/ {kgToLbs(historyEntry.value).toFixed(2)} lbs&nbsp;</Typography>
        </Typography>

        {isDeletable && (
          <IconButton
            size="small"
            aria-label="delete"
            sx={{ ml: 'auto', color: theme.palette.warning.dark }}
            onClick={handleDeleteClick}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <DeleteVitalModal
        open={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        entity={historyEntry}
        onDelete={onDelete}
      />
    </>
  );
};

export default VitalWeightHistoryElement;
