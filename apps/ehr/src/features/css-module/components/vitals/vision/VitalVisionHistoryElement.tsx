import { DeleteOutlined as DeleteIcon } from '@mui/icons-material';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import React, { JSX, useMemo, useState } from 'react';
import { getVisionExtraOptionsFormattedString, VitalsObservationDTO } from 'utils';
import { DeleteVitalModal } from '../DeleteVitalModal';
import { VitalVisionHistoryEntry } from './VitalVisionEntry';

type VitalVisionHistoryElementProps = {
  historyEntry: VitalVisionHistoryEntry;
  onDelete: (entity: VitalsObservationDTO) => Promise<void>;
};

export const VitalVisionHistoryElement: React.FC<VitalVisionHistoryElementProps> = ({
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
  const lineColor = theme.palette.text.primary;

  const visionOptionsLine = useMemo(() => {
    return getVisionExtraOptionsFormattedString(historyEntry.extraOptions);
  }, [historyEntry.extraOptions]);

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
            Left eye: {historyEntry.leftEyeVision ?? '-'};&nbsp;
          </Typography>
          <Typography component="span" sx={{ fontWeight: 'bold', color: lineColor }}>
            Right eye: {historyEntry.rightEyeVision ?? '-'};&nbsp; {visionOptionsLine && `${visionOptionsLine}`}
          </Typography>
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

export default VitalVisionHistoryElement;
