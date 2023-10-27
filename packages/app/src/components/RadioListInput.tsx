import { FormControl, FormControlLabel, Radio, RadioGroup, RadioGroupProps, SxProps } from '@mui/material';
import { FC, SyntheticEvent } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { RadioOption } from '../types';
import { BoldPrimaryInputLabel } from './BoldPrimaryInputLabel';
import { InputHelperText } from './InputHelperText';

type RadioListInputProps = {
  borderColor?: string;
  centerImages?: boolean;
  helperText?: string;
  label: string;
  name: string;
  onChange: (event: SyntheticEvent) => void;
  options: RadioOption[];
  radioStyling?: SxProps;
  required?: boolean;
} & RadioGroupProps;

export const RadioListInput: FC<RadioListInputProps> = ({
  defaultValue,
  helperText,
  label,
  name,
  onChange,
  options,
  required,
  value,
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  // const theme = useTheme();

  return (
    <Controller
      control={control}
      defaultValue={defaultValue}
      name={name}
      render={({ field }) => {
        return (
          <FormControl error={!!errors[name]} required={required} sx={{ mt: 3.5, width: '100%' }}>
            {/* Had to add a margin here and on FormControl because none of the variants worked properly */}
            {/* Same for padding. I want to emphasize how much I hate this. */}
            <BoldPrimaryInputLabel htmlFor={`${name}-label`} shrink sx={{ mt: -2.25 }}>
              {label}
            </BoldPrimaryInputLabel>
            <RadioGroup row value={field.value || 'unknown'}>
              {options.map((option) => {
                return (
                  <FormControlLabel
                    key={option.value}
                    control={<Radio />}
                    label={option.label}
                    onChange={onChange}
                    sx={{
                      mr: 5,
                    }}
                    value={option.value}
                  />
                );
              })}
            </RadioGroup>
            {!value && <InputHelperText errors={errors} helperText={helperText} name={name} />}
          </FormControl>
        );
      }}
    />
  );
};
