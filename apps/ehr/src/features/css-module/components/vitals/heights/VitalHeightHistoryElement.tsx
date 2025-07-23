import { DeleteOutlined as DeleteIcon } from '@mui/icons-material';
import ErrorIcon from '@mui/icons-material/Error';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import React, { JSX, useState } from 'react';
import { formatDateTimeToLocalTimezone, VitalsHeightObservationDTO, VitalsObservationDTO } from 'utils';
import { DeleteVitalModal } from '../DeleteVitalModal';

type VitalHeightHistoryElementProps = {
  historyEntry: VitalsHeightObservationDTO;
  isAlert?: boolean;
  onDelete?: (entity: VitalsObservationDTO) => Promise<void>;
};

export const VitalHeightHistoryElement: React.FC<VitalHeightHistoryElementProps> = ({
  historyEntry,
  isAlert = false,
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
  const lineColor = isAlert ? theme.palette.error.main : theme.palette.text.primary;

  const isDeletable = onDelete !== undefined && historyEntry.resourceId !== undefined;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography color="textPrimary">
          {formatDateTimeToLocalTimezone(historyEntry.lastUpdated)} {hasAuthor && 'by'} {historyEntry.authorName} -
          &nbsp;
          <Typography component="span" sx={{ fontWeight: 'bold', color: lineColor }}>
            {historyEntry.value} cm &nbsp;
          </Typography>
          <Typography component="span" sx={{ color: lineColor }}>
            / {100} inch
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
        onDelete={async (obs) => onDelete?.(obs)}
      />
    </>
  );
};

export default VitalHeightHistoryElement;
