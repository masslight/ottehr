import { Box, FormHelperText } from '@mui/material';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers-pro';
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

type Props = {
  name: string;
  label: string;
  required?: boolean;
};

export const TimeInput: React.FC<Props> = ({ name, label, required }) => {
  const { formState, control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? REQUIRED_FIELD_ERROR_MESSAGE : false }}
      render={({ field, fieldState: { error } }) => (
        <Box id="myid" sx={{ width: '100%' }}>
          <LocalizationProvider dateAdapter={AdapterLuxon}>
            <TimePicker
              sx={{ width: '100% ' }}
              label={label + (required ? '*' : '')}
              slotProps={{
                textField: {
                  style: { width: '100%' },
                  size: 'small',
                  error: formState.errors[name] != null,
                },
              }}
              value={field.value || null}
              onChange={field.onChange}
            />
          </LocalizationProvider>
          {error && <FormHelperText error={true}>{error?.message}</FormHelperText>}
        </Box>
      )}
    />
  );
};
