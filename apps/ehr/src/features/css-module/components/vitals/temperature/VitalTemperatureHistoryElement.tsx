import { DeleteOutlined as DeleteIcon } from '@mui/icons-material';
import ErrorIcon from '@mui/icons-material/Error';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import React, { JSX, useState } from 'react';
import { VitalsObservationDTO } from 'utils';
import { DeleteVitalModal } from '../DeleteVitalModal';
import { VitalTemperatureHistoryEntry } from './VitalTemperatureHistoryEntry';

type VitalTemperatureHistoryElementProps = {
  historyEntry: VitalTemperatureHistoryEntry;
  onDelete: (entity: VitalsObservationDTO) => Promise<void>;
};

export const VitalTemperatureHistoryElement: React.FC<VitalTemperatureHistoryElementProps> = ({
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
  const lineColor = historyEntry.isTemperatureWarning ? theme.palette.error.main : theme.palette.text.primary;

  const observationMethod = historyEntry.vitalObservationDTO?.observationMethod;

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
            {historyEntry.temperatureCelsius} C
          </Typography>
          {historyEntry.isTemperatureWarning && (
            <ErrorIcon fontSize="small" sx={{ ml: '4px', verticalAlign: 'middle', color: lineColor }} />
          )}
          {observationMethod && ` (${observationMethod})`}
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

export default VitalTemperatureHistoryElement;
