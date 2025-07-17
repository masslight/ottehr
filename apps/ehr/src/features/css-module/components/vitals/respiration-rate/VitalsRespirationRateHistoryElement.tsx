import { DeleteOutlined as DeleteIcon } from '@mui/icons-material';
import ErrorIcon from '@mui/icons-material/Error';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import React, { JSX, useMemo, useState } from 'react';
import { VitalsObservationDTO, VitalsRespirationRateObservationDTO } from 'utils';
import { DeleteVitalModal } from '../DeleteVitalModal';

type VitalsRespirationRateHistoryElementProps = {
  historyEntry: VitalsRespirationRateObservationDTO;
  isAlert?: boolean;
  isDeletable?: boolean;
  onDelete: (entity: VitalsObservationDTO) => Promise<void>;
};

export const VitalsRespirationRateHistoryElementElement: React.FC<VitalsRespirationRateHistoryElementProps> = ({
  historyEntry,
  isAlert = false,
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

  const hasAuthor = !!historyEntry.authorName && historyEntry.authorName?.length > 0;
  const lineColor = useMemo(() => {
    if (isAlert) return theme.palette.error.main;
    return theme.palette.text.primary;
  }, [isAlert, theme.palette.error.main, theme.palette.text.primary]);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography color="textPrimary">
          {historyEntry.lastUpdated} {hasAuthor && 'by'} {historyEntry.authorId} - &nbsp;
          <Typography component="span" sx={{ fontWeight: 'bold', color: lineColor }}>
            {historyEntry.value}/min
          </Typography>
          {isAlert && <ErrorIcon fontSize="small" sx={{ ml: '4px', verticalAlign: 'middle', color: lineColor }} />}
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

export default VitalsRespirationRateHistoryElementElement;
