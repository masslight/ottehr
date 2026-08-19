import { Autocomplete, Box, TextField, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { formatISOStringToDateAndTime } from 'src/helpers/formatDateTime';
import { PatientVisitOption } from 'src/hooks/usePatientVisitOptions';

export type VisitFilterAutocompleteProps = {
  visitOptions: PatientVisitOption[];
  isLoading: boolean;
  selectedVisit: PatientVisitOption | null;
  onVisitSelected: (visit: PatientVisitOption | null) => void;
};

const visitLabel = (visit: PatientVisitOption): string =>
  visit.dateTime ? formatISOStringToDateAndTime(visit.dateTime) : visit.appointmentId ?? visit.encounterId;

/**
 * Visit picker for the patient Docs filters. Free-solo is off: a visit either exists or it doesn't,
 * and typing filters the list by date/time or visit id.
 */
export const VisitFilterAutocomplete: FC<VisitFilterAutocompleteProps> = ({
  visitOptions,
  isLoading,
  selectedVisit,
  onVisitSelected,
}) => {
  const theme = useTheme();

  return (
    <Autocomplete
      size="small"
      fullWidth
      loading={isLoading}
      options={visitOptions}
      value={selectedVisit}
      onChange={(_event, value) => onVisitSelected(value)}
      isOptionEqualToValue={(option, value) => option.encounterId === value.encounterId}
      getOptionLabel={visitLabel}
      filterOptions={(options, { inputValue }) => {
        const search = inputValue.trim().toLowerCase();
        if (!search) return options;
        return options.filter(
          (option) =>
            visitLabel(option).toLowerCase().includes(search) ||
            (option.appointmentId ?? '').toLowerCase().includes(search)
        );
      }}
      renderOption={(props, option) => (
        <li {...props} key={option.encounterId}>
          <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Typography variant="body2">{visitLabel(option)}</Typography>
            {option.appointmentId && (
              <Typography
                variant="caption"
                sx={{ color: theme.palette.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {option.appointmentId}
              </Typography>
            )}
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField {...params} label="Visit" placeholder="Select Visit" InputLabelProps={{ shrink: true }} />
      )}
    />
  );
};
