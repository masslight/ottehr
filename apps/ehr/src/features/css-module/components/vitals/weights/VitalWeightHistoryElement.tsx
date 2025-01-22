import React, { JSX, useState } from 'react';
import { useTheme, Box, Typography, IconButton } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import { DeleteOutlined as DeleteIcon } from '@mui/icons-material';
import { VitalWeightHistoryEntry } from './VitalWeightHistoryEntry';
import { VitalsObservationDTO } from 'utils';
import { DeleteVitalModal } from '../DeleteVitalModal';

type VitalWeightHistoryElementProps = {
  historyEntry: VitalWeightHistoryEntry;
  onDelete: (entity: VitalsObservationDTO) => Promise<void>;
};

export const VitalWeightHistoryElement: React.FC<VitalWeightHistoryElementProps> = ({
  historyEntry,
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

  const hasAuthor = !!historyEntry.author && historyEntry.author?.length > 0;
  const lineColor = historyEntry.isPercentileWarning ? theme.palette.error.main : theme.palette.text.primary;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography color="textPrimary">
          {historyEntry.debugEntrySource && (
            <Typography component="span" sx={{ fontWeight: 'bold', color: theme.palette.text.primary }}>
              {historyEntry.debugEntrySource === 'encounter' ? '[DEBUG_ENC]' : '[DEBUG_PAT]'}&nbsp;
            </Typography>
          )}
          {historyEntry.recordDateTime} {hasAuthor && 'by'} {historyEntry.author} - &nbsp;
          <Typography component="span" sx={{ fontWeight: 'bold', color: lineColor }}>
            {historyEntry.weightKg} kg &nbsp;
          </Typography>
          <Typography component="span" sx={{ color: lineColor }}>
            / {historyEntry.weightLbs} lbs&nbsp;
          </Typography>
          <Typography component="span" sx={{ color: lineColor }}>
            / {historyEntry.percentile} percentile
          </Typography>
          {historyEntry.isPercentileWarning && (
            <ErrorIcon fontSize="small" sx={{ ml: '4px', verticalAlign: 'middle', color: lineColor }} />
          )}
        </Typography>

        {historyEntry.isDeletable && (
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
        entity={historyEntry.vitalObservationDTO}
        onDelete={onDelete}
      />
    </>
  );
};

export default VitalWeightHistoryElement;
