import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Box,
  FormControl,
  IconButton,
  Input,
  InputBaseComponentProps,
  InputProps,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { FC, useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { getInputTypes } from 'utils';
import { useIntakeThemeContext } from '../../contexts';
import { BoldPurpleInputLabel } from './BoldPurpleInputLabel';
import { InputHelperText } from './InputHelperText';
import InputMask from './InputMask';
import { LightToolTip } from './LightToolTip';

type FormInputProps = {
  name: string;
  label: string;
  format?: string;
  infoText?: string;
  helperText?: string;
  autoComplete?: string;
  showHelperTextIcon?: boolean;
  infoTextSecondary?: string;
  mask?: string;
  maxCharacters?: {
    totalCharacters: number;
    displayCharCount: number;
  };
} & InputProps;

const FormInput: FC<FormInputProps> = ({
  name,
  label,
  format,
  defaultValue,
  helperText,
  autoComplete,
  showHelperTextIcon,
  infoText,
  infoTextSecondary,
  mask,
  maxCharacters,
  ...otherProps
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const theme = useTheme();
  const { t } = useTranslation();
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

  const exceedsMaxCharacters = useCallback(
    (val: any) => {
      if (maxCharacters) {
        return (val as string).length > maxCharacters.totalCharacters;
      } else {
        return false;
      }
    },
    [maxCharacters]
  );

  const inputProps: InputBaseComponentProps = {
    mask: mask,
  };

  if (getInputTypes(name) === 'number' || getInputTypes(name) === 'tel') {
    inputProps.pattern = '[0-9]*';
  }
  if (format === 'Decimal') {
    inputProps.pattern = '^\\d+(.\\d+)?$';
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
            autoComplete={autoComplete}
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
          {maxCharacters && value.length > maxCharacters.displayCharCount && (
            <Typography variant="caption" color={exceedsMaxCharacters(value) ? 'error' : 'text.secondary'}>
              {`${value.length} / ${maxCharacters.totalCharacters}`}
            </Typography>
          )}
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
                <Typography sx={{ fontSize: '14px', marginLeft: 0.5 }}>
                  {t('aboutPatient.birthSex.whyAskLabel')}
                </Typography>
              </Box>
            </LightToolTip>
          ) : null}
          <InputHelperText
            name={name}
            errors={errors}
            helperText={helperText}
            showHelperTextIcon={showHelperTextIcon}
          />
        </FormControl>
      )}
    />
  );
};

export default FormInput;
