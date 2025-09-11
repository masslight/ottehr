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
  validate?: (value: string | undefined) => boolean | string;
  selectOnly?: boolean;
  onInputTextChanged?: (text: string) => void;
  noOptionsText?: string;
};

export const AutocompleteInput: React.FC<Props> = ({
  name,
  label,
  options,
  loading,
  required,
  validate,
  selectOnly,
  onInputTextChanged,
  noOptionsText,
}) => {
  const { control } = useFormContext();
  if (loading && !options) {
    return <Skeleton variant="rectangular" width="100%" height={40} />;
  }
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? REQUIRED_FIELD_ERROR_MESSAGE : false, validate: validate }}
      render={({ field, fieldState: { error } }) => (
        <Box sx={{ width: '100%' }}>
          <Autocomplete
            value={
              field.value != null
                ? options?.find((option) => option.value === field.value) ?? { label: field.value, value: field.value }
                : null
            }
            options={options ?? []}
            noOptionsText={noOptionsText}
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
                onChange={onInputTextChanged ? (e) => onInputTextChanged(e.target.value) : undefined}
              />
            )}
            loading={loading}
            fullWidth
          />
          {error && <FormHelperText error={true}>{error?.message}</FormHelperText>}
        </Box>
      )}
    />
  );
};
