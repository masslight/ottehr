import { FC, useContext, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  FormControl,
  SelectProps,
  useTheme,
  Autocomplete,
  Chip,
  TextField,
  AutocompleteRenderInputParams,
  InputLabelProps,
} from '@mui/material';
import { IntakeThemeContext } from '../../contexts';
import { BoldPurpleInputLabel } from './BoldPurpleInputLabel';
import { InputHelperText } from './InputHelperText';

type FreeMultiSelectInputProps = {
  name: string;
  helperText?: string;
  label: string;
  options: string[];
  defaultValue: any[];
  placeholder?: string;
} & SelectProps;

const FreeMultiSelectInput: FC<FreeMultiSelectInputProps> = ({
  name,
  helperText,
  label,
  defaultValue,
  options,
  placeholder = 'Type or select all that apply',
  ...otherProps
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const theme = useTheme();
  const { otherColors } = useContext(IntakeThemeContext);
  const [inputValue, setInputValue] = useState<string>('');

  return (
    <Controller
      name={name}
      control={control}
      // need to pass in an empty array if the value is undefined, otherwise the component will be uncontrolled
      defaultValue={defaultValue || []}
      render={({ field }) => {
        return (
          <FormControl
            variant="standard"
            required={otherProps.required}
            error={!!errors[name]}
            sx={{
              width: '100%',
            }}
          >
            <BoldPurpleInputLabel htmlFor={name} shrink>
              {label}
            </BoldPurpleInputLabel>
            <Autocomplete
              multiple
              autoComplete
              disableClearable
              forcePopupIcon
              id={name}
              options={options}
              freeSolo
              fullWidth
              {...field}
              defaultValue={defaultValue || []}
              // Bringing this in breaks the component for some reason
              // {...otherProps}
              renderTags={(options: readonly (string | string)[], getTagProps) =>
                options.map((option, index) => (
                  <Chip variant="outlined" label={option} {...getTagProps({ index })} sx={{ fontSize: 16 }} />
                ))
              }
              inputValue={inputValue}
              onInputChange={(_, newInputValue) => {
                setInputValue(newInputValue);
              }}
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
              renderInput={(params) => (
                <TextField
                  {...(params as AutocompleteRenderInputParams & {
                    InputLabelProps: React.PropsWithChildren<InputLabelProps>;
                  })}
                  variant="filled"
                  // placeholder={defaultValue && Array.isArray(defaultValue) ? defaultValue.join(', ') : placeholder}
                  placeholder={placeholder}
                />
              )}
              sx={{
                mt: 2,
                '& .MuiFilledInput-root': {
                  fontSize: 16,
                  p: 0.5,
                  backgroundColor: `${theme.palette.background.paper} !important`,
                  border: '1px solid',
                  borderColor: otherColors.borderGray,
                  borderRadius: 2,
                  '&::before, ::after, :hover:not(.Mui-disabled, .Mui-error)::before': {
                    borderBottom: 0,
                  },
                },
                '& .Mui-focused': {
                  boxShadow: `${otherColors.primaryBoxShadow} 0 0 0 0.2rem`,
                  borderColor: `${theme.palette.primary.main}`,
                },
              }}
            />
            <InputHelperText name={name} errors={errors} helperText={helperText} />
          </FormControl>
        );
      }}
    />
  );
};

export default FreeMultiSelectInput;
