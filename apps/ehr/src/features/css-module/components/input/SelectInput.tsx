import { Autocomplete, Box, FormHelperText, Skeleton, TextField } from '@mui/material';
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

export interface Option {
  label: string;
  value: string;
}

type Props = {
  name: string;
  label: string;
  options: Option[] | undefined;
  loading?: boolean;
  required?: boolean;
};

export const SelectInput: React.FC<Props> = ({ name, label, options, loading, required }) => {
  const { formState, control } = useFormContext();
  return !loading ? (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? REQUIRED_FIELD_ERROR_MESSAGE : false }}
      render={({ field: { onChange }, fieldState: { error } }) => (
        <Box sx={{ width: '100%' }}>
          <Autocomplete
            options={options ?? []}
            getOptionLabel={(option) => option.label}
            onChange={(data) => onChange(data)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={label}
                placeholder={`Select ${label}`}
                inputProps={{ ...params.inputProps, readOnly: true }}
                error={formState.errors[name] != null}
                required={required}
              />
            )}
            fullWidth
          />
          {error && <FormHelperText error={true}>{error?.message}</FormHelperText>}
        </Box>
      )}
    />
  ) : (
    <Skeleton variant="rectangular" width="100%" height={56} />
  );
};
