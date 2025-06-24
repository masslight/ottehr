import { FormControlLabel, Radio, RadioGroup, RadioGroupProps, SxProps } from '@mui/material';
import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { FC, SyntheticEvent } from 'react';
import { useStyledAnswerOptions } from '../useStyleItems';

interface RadioInputProps extends RadioGroupProps {
  name: string;
  value: string;
  options: QuestionnaireItemAnswerOption[];
  required?: boolean;
  borderColor?: string;
  centerImages?: boolean;
  onChange: (event: SyntheticEvent) => void;
  radioStyling?: SxProps;
}

const RadioListInput: FC<RadioInputProps> = ({ name, value, options: optionsInput, onChange }) => {
  const options = useStyledAnswerOptions(optionsInput);

  return (
    <RadioGroup row value={value} aria-labelledby={`${name}-label`}>
      {options.map((option) => {
        return (
          <FormControlLabel
            value={option.valueString ?? ''}
            control={<Radio checked={value === option.valueString} />}
            key={option.id ?? option.valueString ?? ''}
            label={option.valueString}
            onChange={onChange}
            sx={{
              marginRight: 5,
            }}
          />
        );
      })}
    </RadioGroup>
  );
};

export default RadioListInput;
