import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, FormControl, IconButton, Input, InputBaseComponentProps, InputProps, Tooltip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { getInputTypes } from 'ottehr-utils';
import { useIntakeThemeContext } from '../../contexts';
import { BoldPurpleInputLabel } from './BoldPurpleInputLabel';
import { InputHelperText } from './InputHelperText';
import InputMask from './InputMask';

type FormInputProps = {
  name: string;
  label: string;
  format?: string;
  infoText?: string;
  helperText?: string;
  mask?: string;
} & InputProps;

const FormInput: FC<FormInputProps> = ({
  name,
  label,
  format,
  defaultValue,
  helperText,
  infoText,
  mask,
  ...otherProps
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const theme = useTheme();
  const { otherColors } = useIntakeThemeContext();
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

  const inputProps: InputBaseComponentProps = {
    mask: mask,
  };

  if (getInputTypes(name) === 'number' || getInputTypes(name) === 'tel') {
    inputProps.pattern = '[0-9]*';
  }

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
          <BoldPurpleInputLabel id={`${name}-label`} htmlFor={name} shrink>
            {infoText ? (
              <Tooltip enterTouchDelay={0} title={infoText} placement="top" arrow>
                <Box>
                  {label}
                  <IconButton>
                    <InfoOutlinedIcon sx={{ fontSize: '18px', color: 'secondary.main' }} />
                  </IconButton>
                </Box>
              </Tooltip>
            ) : (
              label
            )}
          </BoldPurpleInputLabel>

          <Input
            id={name}
            value={value}
            type={getInputTypes(name) === 'tel' ? 'tel' : 'text'}
            inputMode={getInputTypes(name) === 'number' || getInputTypes(name) === 'tel' ? 'numeric' : 'text'}
            aria-labelledby={`${name}-label`}
            aria-describedby={`${name}-helper-text`}
            inputComponent={myInputComponent}
            inputProps={inputProps}
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

export default FormInput;
