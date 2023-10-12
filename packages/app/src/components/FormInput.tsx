import { FormControl, Input, InputProps } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { otherColors } from '../OttEHRThemeProvider';
import { BoldPrimaryInputLabel } from './BoldPrimaryInputLabel';
import { InputHelperText } from './InputHelperText';
import { InputMask } from './InputMask';

type FormInputProps = {
  name: string;
  label: string;
  format?: string;
  helperText?: string;
  mask?: string;
} & InputProps;

export const FormInput: FC<FormInputProps> = ({
  name,
  label,
  format,
  defaultValue,
  helperText,
  mask,
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
        borderRadius: '8px',
        border: '1px solid',
        borderColor: otherColors.lightGray,
        padding: '10px 12px',
        transition: theme.transitions.create(['border-color', 'background-color', 'box-shadow']),
        '&:focus': {
          boxShadow: `${alpha(theme.palette.primary.main, 0.25)} 0 0 0 0.2rem`,
          borderColor: theme.palette.primary.main,
        },
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
      name={name}
      defaultValue={defaultValue}
      render={({ field: { value, onChange } }) => (
        <FormControl
          variant="standard"
          required={otherProps.required}
          error={!!errors[name]}
          sx={{
            marginTop: format === 'Signature' ? '20px' : 0,
            width: '100%',
          }}
        >
          <BoldPrimaryInputLabel htmlFor={`${name}-label`} shrink>
            {label}
          </BoldPrimaryInputLabel>
          <Input
            id={`${name}-label`}
            value={value}
            aria-describedby={`${name}-helper-text`}
            inputComponent={myInputComponent}
            inputProps={{ mask: mask }}
            onChange={(e) => onChange(e.target.value.trimStart())}
            {...otherProps}
            disableUnderline
            // todo remove code duplication with DateInput
            sx={format === 'Signature' ? { ...styles.inputStyles, ...styles.signatureStyles } : styles.inputStyles}
          />
          <InputHelperText name={name} errors={errors} helperText={helperText} />
        </FormControl>
      )}
    />
  );
};
