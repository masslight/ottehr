import { FormControl, Input, InputProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { otherColors, otherStyling } from '../OttEHRThemeProvider';
import { BoldPrimaryInputLabel } from './BoldPrimaryInputLabel';
import { InputHelperText } from './InputHelperText';
import { InputMask } from './InputMask';

type FormInputProps = {
  format?: string;
  helperText?: string;
  label: string;
  mask?: string;
  name: string;
} & InputProps;

export const FormInput: FC<FormInputProps> = ({
  defaultValue,
  format,
  helperText,
  label,
  mask,
  name,
  ...otherProps
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const theme = useTheme();
  const myInputComponent = mask ? (InputMask as any) : 'input';
  const signatureFont = 'Dancing Script, Tangerine, Bradley Hand, Brush Script MT, sans-serif';
  const styles = {
    inputStyles: {
      '.MuiInput-input': {
        '&:focus': otherStyling.formFocus,
        border: '1px solid',
        borderColor: otherColors.lightGray,
        borderRadius: '8px',
        p: '10px 12px',
        transition: theme.transitions.create(['border-color', 'background-color', 'box-shadow']),
      },
    },
    signatureStyles: {
      input: {
        fontFamily: signatureFont,
        fontSize: '20px',
        fontWeight: 500,
      },
      'input::placeholder': {
        fontFamily: signatureFont,
      },
    },
  };
  return (
    <Controller
      control={control}
      defaultValue={defaultValue}
      name={name}
      render={({ field: { value, onChange } }) => (
        <FormControl
          error={!!errors[name]}
          required={otherProps.required}
          sx={{
            mt: format === 'Signature' ? '20px' : 0,
            width: '100%',
          }}
          variant="standard"
        >
          <BoldPrimaryInputLabel htmlFor={`${name}-label`} shrink>
            {label}
          </BoldPrimaryInputLabel>
          <Input
            {...otherProps}
            aria-describedby={`${name}-helper-text`}
            disableUnderline
            id={`${name}-label`}
            inputComponent={myInputComponent}
            inputProps={{ mask }}
            onChange={(e) => onChange(e.target.value.trimStart())}
            sx={format === 'Signature' ? { ...styles.inputStyles, ...styles.signatureStyles } : styles.inputStyles}
            value={value}
          />
          <InputHelperText errors={errors} helperText={helperText} name={name} />
        </FormControl>
      )}
    />
  );
};
