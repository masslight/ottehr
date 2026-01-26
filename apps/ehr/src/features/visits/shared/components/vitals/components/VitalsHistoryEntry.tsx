import { DeleteOutlined as DeleteIcon } from '@mui/icons-material';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import React, { JSX, useState } from 'react';
import {
  celsiusToFahrenheit,
  cmToFeet,
  cmToInches,
  formatDateTimeToLocalTimezone,
  formatWeightKg,
  formatWeightLbs,
  getVisionExtraOptionsFormattedString,
  vitalsConfig,
  VitalsObservationDTO,
} from 'utils';
import { DeleteVitalModal } from '../DeleteVitalModal';

type VitalHistoryElementProps<T extends VitalsObservationDTO = VitalsObservationDTO> = {
  historyEntry: T;
  onDelete?: (entity: VitalsObservationDTO) => Promise<void>;
  dataTestId?: string;
};

export const VitalHistoryElement: React.FC<VitalHistoryElementProps> = ({
  historyEntry,
  onDelete,
  dataTestId,
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
  const lineColor = (() => {
    if (historyEntry.alertCriticality === 'critical') return theme.palette.error.main;
    if (historyEntry.alertCriticality === 'abnormal') return theme.palette.warning.main;
    return theme.palette.text.primary;
  })();

  const observationMethod = getObservationMethod(historyEntry);

  const observationValueElements = getObservationValueElements(historyEntry, lineColor);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} data-testid={dataTestId}>
        <Typography color="textPrimary" component="div">
          {formatDateTimeToLocalTimezone(historyEntry.lastUpdated)} {hasAuthor && 'by'} {historyEntry.authorName} -
          &nbsp;
          {observationValueElements.map((value, index) => {
            if (typeof value === 'string') {
              return (
                <Typography
                  key={index}
                  component="span"
                  sx={{ fontWeight: index === 0 ? 'bold' : 'normal', color: lineColor }}
                >
                  {value}
                </Typography>
              );
            } else {
              return { ...value, key: index };
            }
          })}
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

export const getObservationValueElements = (
  historyEntry: VitalsObservationDTO,
  lineColor: string
): (string | JSX.Element)[] => {
  // todo: it would be cool if the units came from the Observation resource
  switch (historyEntry.field) {
    case 'vital-temperature':
      return [`${historyEntry.value} C`, ` = ${celsiusToFahrenheit(historyEntry.value).toFixed(1)} F`];
    case 'vital-oxygen-sat':
      return [`${historyEntry.value}%`];
    case 'vital-heartbeat':
      return [`${historyEntry.value}/min`];
    case 'vital-blood-pressure':
      return [`${historyEntry.systolicPressure}/${historyEntry.diastolicPressure} mm Hg`];
    case 'vital-respiration-rate':
      return [`${historyEntry.value}/min`];
    case 'vital-weight': {
      if (historyEntry.extraWeightOptions?.includes('patient_refused')) {
        return ['Patient Refused'];
      }
      if (historyEntry.value) {
        const kgStr = formatWeightKg(historyEntry.value) + ' kg';
        const lbsStr = formatWeightLbs(historyEntry.value) + ' lbs';
        if (vitalsConfig['vital-weight'].unit == 'kg') {
          return [kgStr, ` = ${lbsStr}`];
        } else {
          return [lbsStr, ` = ${kgStr}`];
        }
      }
      return [];
    }
    case 'vital-height':
      return [
        `${historyEntry.value} cm`,
        ` = ${cmToInches(historyEntry.value).toFixed(1)} in`,
        ` = ${cmToFeet(historyEntry.value).toFixed(1)} ft`,
      ];
    case 'vital-vision':
      return [
        <>
          <Typography component="span" sx={{ fontWeight: 'bold', color: lineColor }}>
            Left eye: {historyEntry.leftEyeVisionText ?? '-'};&nbsp;
          </Typography>
          <Typography component="span" sx={{ fontWeight: 'bold', color: lineColor }}>
            Right eye: {historyEntry.rightEyeVisionText ?? '-'};&nbsp;{' '}
            {`${getVisionExtraOptionsFormattedString(historyEntry.extraVisionOptions) ?? ''}`}
          </Typography>
        </>,
      ];
    case 'vital-last-menstrual-period': {
      return [historyEntry.value, historyEntry.isUnsure ? ' (unsure)' : ''];
    }
    default:
      return [];
  }
};
export default VitalHistoryElement;
