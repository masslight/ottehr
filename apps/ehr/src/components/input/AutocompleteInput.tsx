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
  valueToOption?: (value: any) => Option;
  optionToValue?: (value: Option) => any;
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
  valueToOption,
  optionToValue,
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
      render={({ field, fieldState: { error } }) => {
        let valueOption: Option | null = null;
        if (field.value != null && valueToOption) {
          valueOption = valueToOption(field.value);
        } else if (field.value != null) {
          valueOption = options?.find((option) => option.value === field.value) ?? null;
        }
        const optionsToUse = options ?? [];
        if (valueOption && !options?.find((option) => option.value === valueOption?.value)) {
          optionsToUse?.push(valueOption);
        }
        return (
          <Box sx={{ width: '100%' }}>
            <Autocomplete
              value={valueOption}
              options={optionsToUse}
              noOptionsText={noOptionsText}
              getOptionLabel={(option) => option.label ?? options?.find((o) => o.value === option.value)?.label}
              isOptionEqualToValue={(option, tempValue) => option.value === tempValue.value}
              onChange={(_e, option: any) =>
                field.onChange((option && optionToValue ? optionToValue(option) : option?.value) ?? null)
              }
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
        );
      }}
    />
  );
};
