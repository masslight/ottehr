import { FC, useContext, useState, ReactNode } from 'react';
import { Autocomplete, Box, Chip, FormControl, SelectProps, TextField, Typography, useTheme } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Controller, useFormContext } from 'react-hook-form';
import { BoldPurpleInputLabel } from './BoldPurpleInputLabel';
import { InputHelperText } from './InputHelperText';
import { LightToolTip } from './LightToolTip';
import { VirtualizedListboxComponent } from './VirtualizedListboxComponent';
import { IntakeThemeContext, usePageFormContext } from '../../contexts';
import { SelectInputOption } from '../../types';

type FreeMultiSelectOptions = string[] | SelectInputOption[];

type FreeMultiSelectInputProps = {
  name: string;
  helperText?: string;
  showHelperTextIcon?: boolean;
  infoTextSecondary?: string;
  label: string;
  options: FreeMultiSelectOptions;
  defaultValue: any;
  placeholder?: string;
  multiple?: boolean;
  freeSolo?: boolean;
  submitOnChange?: boolean;
  disableError?: boolean;
  virtualization?: boolean;
} & SelectProps;

const FreeMultiSelectInput: FC<FreeMultiSelectInputProps> = ({
  name,
  helperText,
  showHelperTextIcon,
  infoTextSecondary,
  label,
  defaultValue,
  options,
  placeholder = 'Type or select all that apply',
  multiple = true,
  freeSolo = true,
  submitOnChange = false,
  disableError = false,
  virtualization = false,
  ...otherProps
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const theme = useTheme();
  const { otherColors } = useContext(IntakeThemeContext);
  const [inputValue, setInputValue] = useState<string>('');

  const defaultOrBlank = defaultValue || multiple ? [] : '';

  const { formRef } = usePageFormContext();

  return (
    <Controller
      name={name}
      control={control}
      // need to pass in an empty array if the value is undefined, otherwise the component will be uncontrolled
      defaultValue={defaultOrBlank}
      render={({ field }) => {
        return (
          <FormControl
            variant="standard"
            required={otherProps.required}
            error={disableError ? undefined : !!errors[name]}
            sx={{
              width: '100%',
            }}
          >
            <BoldPurpleInputLabel htmlFor={name} shrink>
              {label}
            </BoldPurpleInputLabel>
            <Autocomplete
              multiple={multiple}
              autoComplete
              disableClearable
              forcePopupIcon
              id={name}
              options={options}
              freeSolo={freeSolo}
              fullWidth
              {...field}
              ListboxComponent={virtualization ? VirtualizedListboxComponent : undefined}
              defaultValue={defaultOrBlank}
              // Bringing this in breaks the component for some reason
              // {...otherProps}
              renderTags={(options, getTagProps) =>
                options.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={typeof option === 'string' ? option : option.label}
                    {...getTagProps({ index })}
                    sx={{ fontSize: 16 }}
                  />
                ))
              }
              getOptionLabel={(option) => {
                if (typeof options[0] === 'object') {
                  const foundOption = (options as SelectInputOption[]).find((item) => item.value === option);
                  if (foundOption) {
                    return foundOption.label;
                  }
                }
                return typeof option === 'string' ? option : option.label;
              }}
              isOptionEqualToValue={(option, value) => {
                if (typeof option === 'object') {
                  return option.value === value;
                } else {
                  return option === value;
                }
              }}
              inputValue={freeSolo ? inputValue : undefined}
              onInputChange={
                freeSolo
                  ? (_, newInputValue) => {
                      setInputValue(newInputValue);
                    }
                  : undefined
              }
              onChange={(_, options) => {
                // The problem is this dictates what renderTags takes, and if we provide only strings then we can't use
                // the label/value combo like in SelectInput. It might be easier to just send the entire long string to
                // the backend e.g. 'PTSD (Post-traumatic Stress Disorder)'

                if (Array.isArray(options)) {
                  // https://github.com/masslight/pmp-ehr/issues/1562
                  // This transformation is only applied to the 'reason for visit' UI selector,
                  // which is currently the only known place where options are an array.
                  // We might consider always applying this transformation without options.every check in the future.
                  // If we encounter other places where options are also arrays and the UI differs,
                  // we should review and potentially update this logic.
                  field.onChange(
                    options.every((option) => typeof option === 'string' || typeof option?.value === 'string')
                      ? options.map((option) => option?.value ?? option)
                      : options,
                  );
                  if (submitOnChange && options.length > 0) {
                    formRef?.current?.requestSubmit();
                  }
                } else {
                  if (typeof options === 'object') {
                    field.onChange(options.value);
                  } else {
                    field.onChange(options);
                  }
                  if (submitOnChange && !!options) {
                    formRef?.current?.requestSubmit();
                  }
                }
              }}
              onBlur={() => {
                if (inputValue.trim() !== '') {
                  const newValues = [...field.value, inputValue.trim()];
                  field.onChange(multiple ? newValues : inputValue.trim());
                }
                if (multiple) setInputValue('');
                if (submitOnChange && !!inputValue.trim()) {
                  formRef?.current?.requestSubmit();
                }
              }}
              renderOption={
                virtualization ? (props, option, state) => [props, option, state.index] as ReactNode : undefined
              }
              renderInput={(params) => (
                <TextField
                  {...params}
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
            {infoTextSecondary ? (
              <LightToolTip
                title={infoTextSecondary}
                placement="top"
                enterTouchDelay={0}
                backgroundColor={otherColors.toolTipGrey}
                color={otherColors.black}
              >
                <Box
                  sx={{
                    color: otherColors.scheduleBorder,
                    width: 'fit-content',
                    display: 'flex',
                    marginTop: 0.5,
                    cursor: 'default',
                  }}
                >
                  <InfoOutlinedIcon style={{ height: '16px', width: '16px' }} />
                  <Typography sx={{ fontSize: '14px', marginLeft: 0.5 }}>Why do we ask this?</Typography>
                </Box>
              </LightToolTip>
            ) : null}
            <InputHelperText
              name={name}
              errors={disableError ? {} : errors}
              helperText={helperText}
              showHelperTextIcon={showHelperTextIcon}
            />
          </FormControl>
        );
      }}
    />
  );
};

export default FreeMultiSelectInput;
