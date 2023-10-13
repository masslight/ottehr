import { Autocomplete, Chip, FormControl, InputBase, SelectProps, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { otherColors } from '../OttEHRThemeProvider';
import { BoldPrimaryInputLabel } from './BoldPrimaryInputLabel';
import { InputHelperText } from './InputHelperText';

type FreeMultiSelectInputProps = {
  defaultValue: any[];
  helperText?: string;
  label: string;
  name: string;
  options: string[];
  // placeholder?: string;
} & SelectProps;

export const FreeMultiSelectInput: FC<FreeMultiSelectInputProps> = ({
  defaultValue,
  helperText,
  label,
  name,
  options,
  // placeholder = 'Type or select all that apply',
  ...otherProps
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const theme = useTheme();
  const [inputValue, setInputValue] = useState<string>('');

  console.log(errors);

  return (
    <Controller
      control={control}
      // need to pass in an empty array if the value is undefined, otherwise the component will be uncontrolled
      defaultValue={defaultValue || []}
      name={name}
      render={({ field }) => {
        return (
          <FormControl
            error={!!errors[name]}
            required={otherProps.required}
            variant="standard"
            sx={{
              width: '100%',
            }}
          >
            <BoldPrimaryInputLabel id={`${name}-label`} shrink>
              {label}
            </BoldPrimaryInputLabel>
            <Autocomplete
              {...field}
              autoComplete
              defaultValue={defaultValue || []}
              disableClearable
              forcePopupIcon
              freeSolo
              fullWidth
              id={`${name}-label`}
              inputValue={inputValue}
              multiple
              options={options}
              // Bringing this in breaks the component for some reason
              // {...otherProps}
              onChange={(_, options) => {
                // The problem is this dictates what renderTags takes, and if we provide only strings then we can't use
                // the label/value combo like in SelectInput. It might be easier to just send the entire long string to
                // the backend e.g. 'PTSD (Post-traumatic Stress Disorder)'

                field.onChange(options);
              }}
              onBlur={() => {
                if (inputValue.trim() !== '') {
                  const newValues = [...field.value, inputValue.trim()];
                  field.onChange(newValues);
                }
                setInputValue('');
              }}
              onInputChange={(_, newInputValue) => {
                setInputValue(newInputValue);
              }}
              renderInput={(params) => (
                <InputBase autoFocus inputProps={params.inputProps} ref={params.InputProps.ref} />
              )}
              renderTags={(options: readonly (string | string)[], getTagProps) =>
                options.map((option, index) => (
                  <Chip {...getTagProps({ index })} label={option} variant="outlined" sx={{ fontSize: 16 }} />
                ))
              }
              sx={{
                mt: 2,
                '& .Mui-focused': {
                  borderColor: `${theme.palette.primary.main}`,
                  boxShadow: `${otherColors.primaryBoxShadow} 0 0 0 0.2rem`,
                },
                '& .MuiFilledInput-root': {
                  backgroundColor: `${theme.palette.background.paper} !important`,
                  border: '1px solid',
                  borderColor: otherColors.borderGray,
                  borderRadius: 2,
                  '&::before, ::after, :hover:not(.Mui-disabled, .Mui-error)::before': {
                    borderBottom: 0,
                  },
                  fontSize: 16,
                  p: 0.5,
                },
              }}
            />
            <InputHelperText errors={errors} helperText={helperText} name={name} />
          </FormControl>
        );
      }}
    />
  );
};
