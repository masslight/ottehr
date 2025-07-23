import { DeleteOutlined as DeleteIcon } from '@mui/icons-material';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import React, { JSX, useState } from 'react';
import {
  cmToInches,
  formatDateTimeToLocalTimezone,
  getVisionExtraOptionsFormattedString,
  kgToLbs,
  VitalsObservationDTO,
} from 'utils';
import { DeleteVitalModal } from '../DeleteVitalModal';

type VitalHistoryElementProps<T extends VitalsObservationDTO = VitalsObservationDTO> = {
  historyEntry: T;
  onDelete?: (entity: VitalsObservationDTO) => Promise<void>;
};

export const VitalHistoryElement: React.FC<VitalHistoryElementProps> = ({ historyEntry, onDelete }): JSX.Element => {
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
  const lineColor = (() => {
    if (historyEntry.alertCriticality === 'critical') return theme.palette.error.main;
    if (historyEntry.alertCriticality === 'abnormal') return theme.palette.warning.main;
    return theme.palette.text.primary;
  })();

  const observationMethod = getObservationMethod(historyEntry);

  const observationValueElements = getObservationValueElements(historyEntry);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography color="textPrimary">
          {formatDateTimeToLocalTimezone(historyEntry.lastUpdated)} {hasAuthor && 'by'} {historyEntry.authorName} -
          &nbsp;
          {observationValueElements.map((value, index) => (
            <Typography key={index} component="span" sx={{ fontWeight: 'bold', color: lineColor }}>
              {value}
            </Typography>
          ))}
          {historyEntry.alertCriticality === 'critical' && (
            <ErrorIcon fontSize="small" sx={{ ml: '4px', verticalAlign: 'middle', color: lineColor }} />
          )}
          {historyEntry.alertCriticality === 'abnormal' && (
            <WarningAmberOutlinedIcon
              fontSize="small"
              sx={{ ml: '4px', verticalAlign: 'middle', color: theme.palette.warning.light }}
            />
          )}
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

const getObservationMethod = (historyEntry: VitalsObservationDTO): string | undefined => {
  if (
    historyEntry.field === 'vital-temperature' ||
    historyEntry.field === 'vital-oxygen-sat' ||
    historyEntry.field === 'vital-heartbeat' ||
    historyEntry.field === 'vital-blood-pressure'
  ) {
    return historyEntry.observationMethod;
  }
  return undefined;
};

const getObservationValueElements = (historyEntry: VitalsObservationDTO): string[] => {
  // todo: it would be cool if the units came from the Observation resource
  switch (historyEntry.field) {
    case 'vital-temperature':
      return [`${historyEntry.value} C`];
    case 'vital-oxygen-sat':
      return [`${historyEntry.value}%`];
    case 'vital-heartbeat':
      return [`${historyEntry.value}/min`];
    case 'vital-blood-pressure':
      return [`${historyEntry.systolicPressure}/${historyEntry.diastolicPressure} mm Hg`];
    case 'vital-respiration-rate':
      return [`${historyEntry.value}/min`];
    case 'vital-weight':
      return [`${historyEntry.value} kg`, `/ ${kgToLbs(historyEntry.value).toFixed(2)} lb`];
    case 'vital-height':
      return [`${historyEntry.value} cm`, `/ ${cmToInches(historyEntry.value).toFixed(2)} in`];
    case 'vital-vision':
      return [
        `Left eye: ${historyEntry.leftEyeVisionText ?? '-'}`,
        `Right eye: ${historyEntry.rightEyeVisionText ?? '-'} \n ${getVisionExtraOptionsFormattedString(
          historyEntry.extraVisionOptions
        )}`,
      ];
    default:
      return [];
  }
};
export default VitalHistoryElement;
