import { DeleteOutlined as DeleteIcon } from '@mui/icons-material';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import React, { JSX, useMemo, useState } from 'react';
import {
  formatDateTimeToLocalTimezone,
  getVisionExtraOptionsFormattedString,
  VitalsObservationDTO,
  VitalsVisionObservationDTO,
} from 'utils';
import { DeleteVitalModal } from '../DeleteVitalModal';

type VitalVisionHistoryElementProps = {
  historyEntry: VitalsVisionObservationDTO;
  onDelete?: (entity: VitalsObservationDTO) => Promise<void>;
};

export const VitalVisionHistoryElement: React.FC<VitalVisionHistoryElementProps> = ({
  historyEntry,
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

  const hasAuthor = !!historyEntry.authorName && historyEntry.authorName.length > 0;
  const lineColor = theme.palette.text.primary;

  const visionOptionsLine = useMemo(() => {
    return getVisionExtraOptionsFormattedString(historyEntry.extraVisionOptions);
  }, [historyEntry.extraVisionOptions]);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography color="textPrimary">
          {formatDateTimeToLocalTimezone(historyEntry.lastUpdated)} {hasAuthor && 'by'} {historyEntry.authorName} -
          &nbsp;
          <Typography component="span" sx={{ fontWeight: 'bold', color: lineColor }}>
            Left eye: {historyEntry.leftEyeVisionText ?? '-'};&nbsp;
          </Typography>
          <Typography component="span" sx={{ fontWeight: 'bold', color: lineColor }}>
            Right eye: {historyEntry.rightEyeVisionText ?? '-'};&nbsp; {visionOptionsLine && `${visionOptionsLine}`}
          </Typography>
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

export default VitalVisionHistoryElement;
