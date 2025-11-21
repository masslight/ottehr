import { Box, FormHelperText } from '@mui/material';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DesktopTimePicker, LocalizationProvider } from '@mui/x-date-pickers-pro';
import { DateTime } from 'luxon';
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

type Props = {
  name: string;
  label: string;
  required?: boolean;
  validate?: (value: string | undefined) => boolean | string;
  dataTestId?: string;
};

export const TimeInput: React.FC<Props> = ({ name, label, required, validate, dataTestId }) => {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? REQUIRED_FIELD_ERROR_MESSAGE : false, validate: validate }}
      render={({ field, fieldState: { error } }) => (
        <Box id="myId" sx={{ width: '100%' }}>
          <LocalizationProvider dateAdapter={AdapterLuxon}>
            <DesktopTimePicker
              sx={{ width: '100% ' }}
              label={label + (required ? '*' : '')}
              slotProps={{
                textField: {
                  style: { width: '100%' },
                  size: 'small',
                  error: error != null,
                  inputProps: {
                    'data-testid': dataTestId,
                  },
                },
              }}
              value={field.value ? DateTime.fromISO(field.value) : null}
              onChange={(val) => field.onChange(val ? val.toISO() : null)}
            />
          </LocalizationProvider>
          {error && <FormHelperText error={true}>{error?.message}</FormHelperText>}
        </Box>
      )}
    />
  );
};
