import { Box, FormHelperText } from '@mui/material';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DesktopDatePicker, LocalizationProvider } from '@mui/x-date-pickers-pro';
import { DateTime } from 'luxon';
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

type Props = {
  name: string;
  label: string;
  required?: boolean;
  validate?: (value: string | undefined) => boolean | string;
  dataTestId?: string;
  disabled?: boolean;
  size?: 'small' | 'medium';
  showTodayButton?: boolean;
};

export const DateInput: React.FC<Props> = ({
  name,
  label,
  required,
  validate,
  dataTestId,
  disabled,
  size,
  showTodayButton,
}) => {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? REQUIRED_FIELD_ERROR_MESSAGE : false, validate: validate }}
      render={({ field, fieldState: { error } }) => (
        <Box sx={{ width: '100%' }}>
          <LocalizationProvider dateAdapter={AdapterLuxon}>
            <DesktopDatePicker
              sx={{ width: '100% ' }}
              label={label + (required ? '*' : '')}
              slotProps={{
                textField: {
                  style: { width: '100%' },
                  size: size ?? 'small',
                  error: error != null,
                  inputProps: {
                    'data-testid': dataTestId,
                  },
                },
                actionBar: showTodayButton
                  ? {
                      actions: ['today'],
                      // @ts-expect-error - that's valid field
                      'data-testid': dataTestIds.dashboard.datePickerTodayButton,
                    }
                  : undefined,
              }}
              value={field.value ? DateTime.fromISO(field.value) : null}
              onChange={(val) => field.onChange(val ? val.toISODate() : null)}
              disabled={disabled}
            />
          </LocalizationProvider>
          {error && <FormHelperText error={true}>{error?.message}</FormHelperText>}
        </Box>
      )}
    />
  );
};
