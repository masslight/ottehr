import ClearIcon from '@mui/icons-material/Clear';
import {
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Stack } from '@mui/system';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers-pro';
import { DateTime } from 'luxon';
import { FC, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  extractInfusionDuration,
  InfusionDuration,
  isPlausibleLengthCm,
  MAX_PLAUSIBLE_LENGTH_CM,
  REPAIR_DEPTH_OPTIONS,
} from 'utils';
import { ProcedureFieldVisibility } from './procedureFieldVisibility';

const timeStringToDateTime = (value: string | undefined): DateTime | null =>
  value != null ? DateTime.fromFormat(value, 'HH:mm') : null;

const dateTimeToTimeString = (value: DateTime | null): string | undefined =>
  value?.isValid ? value.toFormat('HH:mm') : undefined;

const LENGTH_RANGE_MESSAGE = `Enter a wound/lesion size between 0.1 and ${MAX_PLAUSIBLE_LENGTH_CM} cm`;

function infusionTimesError(duration: InfusionDuration | undefined): string | undefined {
  if (duration == null) {
    return undefined;
  }

  if (duration.implausible) {
    return `Check these times — the span is ${duration.durationMinutes} minutes`;
  }

  return undefined;
}

interface WoundSizeFieldProps {
  value?: number;
  onChange: (value: number | undefined) => void;
  disabled: boolean;
}

const WoundSizeField: FC<WoundSizeFieldProps> = ({ value, onChange, disabled }) => {
  const [rejected, setRejected] = useState<string | undefined>(undefined);

  const handleChange = (raw: string): void => {
    if (raw === '') {
      setRejected(undefined);
      onChange(undefined);
      return;
    }
    const parsed = parseFloat(raw);
    if (isPlausibleLengthCm(parsed)) {
      setRejected(undefined);
      onChange(parsed);
      return;
    }
    setRejected(raw);
    onChange(undefined);
  };

  return (
    <TextField
      label="Wound/lesion size (cm)"
      size="small"
      type="number"
      inputProps={{ min: 0, step: 0.1 }}
      value={rejected ?? value ?? ''}
      onChange={(e) => handleChange(e.target.value)}
      error={rejected != null}
      helperText={rejected != null ? LENGTH_RANGE_MESSAGE : undefined}
      disabled={disabled}
      data-testid={dataTestIds.documentProcedurePage.lengthCmInput}
    />
  );
};

interface ConditionalCodingFieldsProps {
  visibility: ProcedureFieldVisibility;
  isReadOnly: boolean;
  lengthCm?: number;
  repairDepth?: string;
  infusionStartTime?: string;
  infusionStopTime?: string;
  onLengthChange: (value: number | undefined) => void;
  onRepairDepthChange: (value: string | undefined) => void;
  onInfusionStartChange: (value: string | undefined) => void;
  onInfusionStopChange: (value: string | undefined) => void;
}

export const ConditionalCodingFields: FC<ConditionalCodingFieldsProps> = ({
  visibility,
  isReadOnly,
  lengthCm,
  repairDepth,
  infusionStartTime,
  infusionStopTime,
  onLengthChange,
  onRepairDepthChange,
  onInfusionStartChange,
  onInfusionStopChange,
}) => {
  const duration = visibility.infusionTimes
    ? extractInfusionDuration({ infusionStartTime, infusionStopTime }, '')
    : undefined;
  const timesError = infusionTimesError(duration);

  return (
    <>
      {visibility.length && <WoundSizeField value={lengthCm} onChange={onLengthChange} disabled={isReadOnly} />}
      {visibility.repairDepth && (
        <FormControl fullWidth sx={{ backgroundColor: 'white' }} size="small" disabled={isReadOnly}>
          <InputLabel id="Repair depth">Repair depth</InputLabel>
          <Select
            label="Repair depth"
            labelId="Repair depth"
            variant="outlined"
            value={repairDepth ?? ''}
            onChange={(e) => onRepairDepthChange(e.target.value || undefined)}
            data-testid={dataTestIds.documentProcedurePage.repairDepthSelect}
            input={
              <OutlinedInput
                label="Repair depth"
                endAdornment={
                  repairDepth && !isReadOnly ? (
                    <InputAdornment position="end" sx={{ mr: '16px' }}>
                      <IconButton
                        aria-label="Clear Repair depth"
                        size="small"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          onRepairDepthChange(undefined);
                        }}
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null
                }
              />
            }
          >
            {REPAIR_DEPTH_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Typography color="textPrimary" sx={{ fontSize: '16px' }}>
                  {option.label}
                </Typography>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
      {visibility.infusionTimes && (
        <Stack direction="row" spacing={2} alignItems="center">
          <LocalizationProvider dateAdapter={AdapterLuxon}>
            <TimePicker
              label="Start time"
              slotProps={{
                textField: {
                  InputLabelProps: { shrink: true },
                  InputProps: { size: 'small' },
                  // The picker root does not forward data-* attributes; the testid rides on the input.
                  inputProps: { 'data-testid': dataTestIds.documentProcedurePage.infusionStartTimeInput },
                  error: timesError != null,
                },
              }}
              value={timeStringToDateTime(infusionStartTime)}
              onChange={(time: DateTime | null) => onInfusionStartChange(dateTimeToTimeString(time))}
              disabled={isReadOnly}
            />
          </LocalizationProvider>
          <LocalizationProvider dateAdapter={AdapterLuxon}>
            <TimePicker
              label="Stop time"
              slotProps={{
                textField: {
                  InputLabelProps: { shrink: true },
                  InputProps: { size: 'small' },
                  inputProps: { 'data-testid': dataTestIds.documentProcedurePage.infusionStopTimeInput },
                  error: timesError != null,
                  helperText: timesError,
                },
              }}
              value={timeStringToDateTime(infusionStopTime)}
              onChange={(time: DateTime | null) => onInfusionStopChange(dateTimeToTimeString(time))}
              disabled={isReadOnly}
            />
          </LocalizationProvider>
          {duration != null && (
            <Typography
              variant="caption"
              color="text.secondary"
              data-testid={dataTestIds.documentProcedurePage.infusionDurationCaption}
            >
              {duration.durationMinutes} min
            </Typography>
          )}
        </Stack>
      )}
    </>
  );
};
