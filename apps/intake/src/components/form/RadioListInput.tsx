import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Box,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  RadioGroupProps,
  SxProps,
  Typography,
} from '@mui/material';
import { FC, SyntheticEvent, useContext, useRef } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { IntakeThemeContext } from '../../contexts';
import { useLabelDimensions } from '../../hooks/useLabelDimensions';
import { RadioOption } from '../../types';
import { BoldPurpleInputLabel } from './BoldPurpleInputLabel';
import { InputHelperText } from './InputHelperText';
import { LightToolTip } from './LightToolTip';

type RadioInputProps = {
  name: string;
  label: string;
  options: RadioOption[];
  required?: boolean;
  helperText?: string;
  showHelperTextIcon?: boolean;
  infoTextSecondary?: string;
  borderColor?: string;
  centerImages?: boolean;
  onChange: (event: SyntheticEvent) => void;
  radioStyling?: SxProps;
} & RadioGroupProps;

const RadioInput: FC<RadioInputProps> = ({
  name,
  label,
  value,
  defaultValue,
  required,
  options,
  helperText,
  showHelperTextIcon,
  infoTextSecondary,
  onChange,
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  const { otherColors } = useContext(IntakeThemeContext);
  const { t } = useTranslation();

  const labelRef = useRef<HTMLLabelElement>(null);
  const { labelHeight, lineHeight } = useLabelDimensions(labelRef);

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={defaultValue}
      render={({ field }) => {
        return (
          <FormControl variant="standard" required={required} error={!!errors[name]} sx={{ width: '100%' }}>
            <BoldPurpleInputLabel id={`${name}-label`} ref={labelRef} shrink sx={{ whiteSpace: 'normal' }}>
              {label}
            </BoldPurpleInputLabel>
            <RadioGroup
              row
              {...field}
              value={field.value || 'unknown'}
              aria-labelledby={`${name}-label`}
              sx={{
                marginTop:
                  lineHeight !== labelHeight ? `${labelHeight ? labelHeight - 8 : lineHeight}px !important` : 2,
              }}
            >
              {options.map((option) => {
                return (
                  <FormControlLabel
                    value={option.value}
                    control={<Radio />}
                    key={option.value}
                    label={option.label}
                    onChange={onChange}
                    sx={{
                      marginRight: 5,
                    }}
                  />
                );
              })}
            </RadioGroup>
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
            {!value && (
              <InputHelperText
                name={name}
                errors={errors}
                helperText={helperText}
                showHelperTextIcon={showHelperTextIcon}
              />
            )}
          </FormControl>
        );
      }}
    />
  );
};

export default RadioInput;
