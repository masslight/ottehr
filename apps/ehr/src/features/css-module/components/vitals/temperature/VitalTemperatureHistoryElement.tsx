import { DeleteOutlined as DeleteIcon } from '@mui/icons-material';
import ErrorIcon from '@mui/icons-material/Error';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import React, { JSX, useState } from 'react';
import { formatDateTimeToLocalTimezone, VitalsObservationDTO, VitalsTemperatureObservationDTO } from 'utils';
import { DeleteVitalModal } from '../DeleteVitalModal';

type VitalTemperatureHistoryElementProps = {
  historyEntry: VitalsTemperatureObservationDTO;
  isAlert?: boolean;
  onDelete?: (entity: VitalsObservationDTO) => Promise<void>;
};

export const VitalTemperatureHistoryElement: React.FC<VitalTemperatureHistoryElementProps> = ({
  historyEntry,
  isAlert = false,
  onDelete,
}): JSX.Element => {
  const theme = useTheme();

  const isDeletable = onDelete !== undefined && historyEntry.resourceId !== undefined;

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const handleDeleteClick = (): void => {
    setIsDeleteModalOpen(true);
  };
  const handleCloseDeleteModal = (): void => {
    setIsDeleteModalOpen(false);
  };

  const hasAuthor = !!historyEntry.authorName && historyEntry.authorName?.length > 0;
  const lineColor = isAlert ? theme.palette.error.main : theme.palette.text.primary;

  const observationMethod = historyEntry.observationMethod;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography color="textPrimary">
          {formatDateTimeToLocalTimezone(historyEntry.lastUpdated)} {hasAuthor && 'by'} {historyEntry.authorName} -
          &nbsp;
          <Typography component="span" sx={{ fontWeight: 'bold', color: lineColor }}>
            {historyEntry.value} C
          </Typography>
          {isAlert && <ErrorIcon fontSize="small" sx={{ ml: '4px', verticalAlign: 'middle', color: lineColor }} />}
          {observationMethod && ` (${observationMethod})`}
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
        onDelete={async (obs) => onDelete?.(obs)}
      />
    </>
  );
};

export default VitalTemperatureHistoryElement;
