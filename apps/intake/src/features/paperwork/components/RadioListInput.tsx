import { FormControlLabel, Radio, RadioGroup, RadioGroupProps, SxProps } from '@mui/material';
import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { FC, SyntheticEvent } from 'react';
import { useQuestionnaireText } from '../getQuestionnaireText';
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
  linkId?: string;
}

const RadioListInput: FC<RadioInputProps> = ({ name, value, options: optionsInput, onChange, linkId }) => {
  const options = useStyledAnswerOptions(optionsInput);
  const qt = useQuestionnaireText();

  return (
    <RadioGroup row value={value} aria-labelledby={`${name}-label`}>
      {options.map((option) => {
        return (
          <FormControlLabel
            value={option.valueString ?? ''}
            control={<Radio checked={value === option.valueString} />}
            key={option.id ?? option.valueString ?? ''}
            label={qt(linkId, option.valueString, `option.${option.valueString}`)}
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
