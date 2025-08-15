import { Autocomplete, Box, FormHelperText, Skeleton, TextField } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { Option } from './Option';

type Props = {
  name: string;
  label: string;
  options: Option[] | undefined;
  loading?: boolean;
  required?: boolean;
  selectOnly?: boolean;
};

export const AutocompleteInput: React.FC<Props> = ({ name, label, options, loading, required, selectOnly }) => {
  const { control } = useFormContext();
  return !loading ? (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? REQUIRED_FIELD_ERROR_MESSAGE : false }}
      render={({ field, fieldState: { error } }) => (
        <Box sx={{ width: '100%' }}>
          <Autocomplete
            value={
              field.value != null
                ? options?.find((option) => option.value === field.value) ?? { label: field.value, value: field.value }
                : null
            }
            options={options ?? []}
            getOptionLabel={(option) => option.label}
            onChange={(_e, option: any) => field.onChange(option?.value ?? null)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={label + (required ? '*' : '')}
                placeholder={`Select ${label}`}
                inputProps={{ ...params.inputProps, readOnly: selectOnly }}
                error={error != null}
                size="small"
              />
            )}
            fullWidth
          />
          {error && <FormHelperText error={true}>{error?.message}</FormHelperText>}
        </Box>
      )}
    />
  ) : (
    <Skeleton variant="rectangular" width="100%" height={40} />
  );
};
