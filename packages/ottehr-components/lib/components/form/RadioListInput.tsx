import { FormControl, FormControlLabel, Radio, RadioGroup, RadioGroupProps, SxProps } from '@mui/material';
import { FC, SyntheticEvent } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { RadioOption } from '../../types';
import { BoldPurpleInputLabel } from './BoldPurpleInputLabel';
import { InputHelperText } from './InputHelperText';

type RadioInputProps = {
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

const RadioInput: FC<RadioInputProps> = ({
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

  //   const theme = useTheme();

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={defaultValue}
      render={({ field }) => {
        return (
          <FormControl variant="standard" required={required} error={!!errors[name]} sx={{ width: '100%', mt: 3.5 }}>
            {/* Had to add a margin here and on FormControl because none of the variants worked properly */}
            {/* Same for padding. I want to emphasize how much I hate this. */}
            <BoldPurpleInputLabel id={`${name}-label`} shrink sx={{ mt: -2.25 }}>
              {label}
            </BoldPurpleInputLabel>
            <RadioGroup row {...field} value={field.value || 'unknown'} aria-labelledby={`${name}-label`}>
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

export default RadioInput;
