import { Box, Checkbox, FormHelperText, Stack, Typography } from '@mui/material';
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

type Props = {
  name: string;
  label: string;
  required?: boolean;
  validate?: (value: string) => boolean | string;
  dataTestId?: string;
};

export const CheckboxInput: React.FC<Props> = ({ name, label, required, validate, dataTestId }) => {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? REQUIRED_FIELD_ERROR_MESSAGE : false, validate: validate }}
      render={({ field, fieldState: { error } }) => (
        <Box sx={{ width: '100%' }}>
          <Stack direction="row" alignItems="center">
            <Checkbox
              checked={field.value}
              onChange={(event) => field.onChange(event.target.checked)}
              data-testid={dataTestId}
            />
            <Typography>{label}</Typography>
          </Stack>
          {error && <FormHelperText error={true}>{error?.message}</FormHelperText>}
        </Box>
      )}
    />
  );
};
