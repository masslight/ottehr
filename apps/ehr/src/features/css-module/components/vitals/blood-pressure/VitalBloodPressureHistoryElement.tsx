import { DeleteOutlined as DeleteIcon } from '@mui/icons-material';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import React, { JSX, useMemo, useState } from 'react';
import { VitalsObservationDTO } from 'utils';
import { DeleteVitalModal } from '../DeleteVitalModal';
import { VitalBloodPressureHistoryEntry } from './VitalBloodPressureHistoryEntry';

type VitalBloodPressureHistoryElementProps = {
  historyEntry: VitalBloodPressureHistoryEntry;
  onDelete: (entity: VitalsObservationDTO) => Promise<void>;
};

export const VitalBloodPressureHistoryElement: React.FC<VitalBloodPressureHistoryElementProps> = ({
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
  const lineColor = useMemo(() => {
    if (historyEntry.bloodPressureSeverity === 'critical') return theme.palette.error.main;
    if (historyEntry.bloodPressureSeverity === 'abnormal') return theme.palette.warning.main;
    return theme.palette.text.primary;
  }, [
    historyEntry.bloodPressureSeverity,
    theme.palette.error.main,
    theme.palette.warning.main,
    theme.palette.text.primary,
  ]);

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
            {historyEntry.systolicPressure}/{historyEntry.diastolicPressure} mm Hg
          </Typography>
          {historyEntry.bloodPressureSeverity === 'critical' && (
            <ErrorIcon fontSize="small" sx={{ ml: '4px', verticalAlign: 'middle', color: lineColor }} />
          )}
          {historyEntry.bloodPressureSeverity === 'abnormal' && (
            <WarningAmberOutlinedIcon
              fontSize="small"
              sx={{ ml: '4px', verticalAlign: 'middle', color: theme.palette.warning.light }}
            />
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

export default VitalBloodPressureHistoryElement;
