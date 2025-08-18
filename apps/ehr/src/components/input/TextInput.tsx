import { Box, FormHelperText, Skeleton, TextField } from '@mui/material';
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

type Props = {
  name: string;
  label: string;
  loading?: boolean;
  required?: boolean;
  multiline?: boolean;
};

export const TextInput: React.FC<Props> = ({ name, label, loading, required, multiline }) => {
  const { control } = useFormContext();
  return !loading ? (
    <Controller
      name={name}
      control={control}
      defaultValue=""
      rules={{ required: required ? REQUIRED_FIELD_ERROR_MESSAGE : false }}
      render={({ field, fieldState: { error } }) => (
        <Box sx={{ width: '100%' }}>
          <TextField
            value={field.value}
            label={label + (required ? '*' : '')}
            placeholder={`Select ${label}`}
            error={error != null}
            onChange={(data) => field.onChange(data)}
            multiline={multiline}
            autoComplete="off"
            variant="outlined"
            size="small"
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
