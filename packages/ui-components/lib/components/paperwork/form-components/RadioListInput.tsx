import { FormControlLabel, Radio, RadioGroup, RadioGroupProps, SxProps } from '@mui/material';
import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { FC, SyntheticEvent } from 'react';
import { getAnswerOptionValue } from 'utils/lib/helpers/paperwork/paperwork';
import { useStyledAnswerOptions } from '../hooks/useStyleItems';

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

export const RadioListInput: FC<RadioInputProps> = ({ name, value, options: optionsInput, onChange }) => {
  const options = useStyledAnswerOptions(optionsInput);

  return (
    <RadioGroup row value={value} aria-labelledby={`${name}-label`}>
      {options.map((option) => {
        const optionValue = getAnswerOptionValue(option);
        return (
          <FormControlLabel
            value={optionValue ?? ''}
            control={<Radio checked={value === optionValue} />}
            key={option.id ?? optionValue ?? ''}
            label={option.label}
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
