import { FormControl, FormControlLabel, Radio, RadioGroup, RadioGroupProps, SxProps } from '@mui/material';
import { FC, SyntheticEvent } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { RadioOption } from '../types';
import { BoldPrimaryInputLabel } from './BoldPrimaryInputLabel';
import { InputHelperText } from './InputHelperText';

type RadioListInputProps = {
  name: string;
  label: string;
  options: RadioOption[];
  required?: boolean;
  helperText?: string;
  borderColor?: string;
  centerImages?: boolean;
  onChange: (event: SyntheticEvent) => void;
  radioStyling?: SxProps;
} & RadioGroupProps;

export const RadioListInput: FC<RadioListInputProps> = ({
  name,
  label,
  value,
  defaultValue,
  required,
  options,
  helperText,
  onChange,
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  // const theme = useTheme();

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={defaultValue}
      render={({ field }) => {
        return (
          <FormControl required={required} error={!!errors[name]} sx={{ width: '100%', mt: 3.5 }}>
            {/* Had to add a margin here and on FormControl because none of the variants worked properly */}
            {/* Same for padding. I want to emphasize how much I hate this. */}
            <BoldPrimaryInputLabel htmlFor={`${name}-label`} shrink sx={{ mt: -2.25 }}>
              {label}
            </BoldPrimaryInputLabel>
            <RadioGroup row value={field.value || 'unknown'}>
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
            {!value && <InputHelperText name={name} errors={errors} helperText={helperText} />}
          </FormControl>
        );
      }}
    />
  );
};
