import React, { FC } from 'react';
import { DateTime } from 'luxon';
import { Controller, useFormContext } from 'react-hook-form';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { TextField } from '@mui/material';
import { DateExcuseFields } from '../../../../utils';

type ControlledExcuseDatePickerProps = {
  name: DateExcuseFields;
  validate?: (value: DateTime | null) => string | undefined;
};

export const ControlledExcuseDatePicker: FC<ControlledExcuseDatePickerProps> = (props) => {
  const { name, validate } = props;

  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={{ validate }}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <LocalizationProvider dateAdapter={AdapterLuxon}>
          <DatePicker
            value={value}
            onChange={onChange}
            inputFormat="MM/dd/yyyy"
            renderInput={(params) => (
              <TextField
                size="small"
                {...params}
                error={!!error}
                helperText={error?.message}
                inputProps={{
                  ...params.inputProps,
                  placeholder: 'MM/DD/YYYY',
                }}
              />
            )}
          />
        </LocalizationProvider>
      )}
    />
  );
};
