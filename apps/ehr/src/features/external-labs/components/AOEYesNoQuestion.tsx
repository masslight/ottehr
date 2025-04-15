import { FormLabel, RadioGroup, FormControlLabel, Radio } from '@mui/material';
import { ControllerRenderProps, FieldValues, useFormContext } from 'react-hook-form';

interface YesNoQuestionProps {
  questionText: string;
  linkId: string;
  answer?: string;
  required: boolean;
  field: ControllerRenderProps<FieldValues, string>;
}

export const AOEYesNoQuestion: React.FC<YesNoQuestionProps> = (props) => {
  const {
    formState: { errors: _ },
  } = useFormContext();

  const { questionText, linkId, answer, required, field } = props;

  const labelId = `boolean-${linkId}-label`;
  return (
    <>
      <FormLabel id={labelId}>{questionText}</FormLabel>
      <RadioGroup
        {...field}
        row
        aria-labelledby={labelId}
        name={`${labelId}-row-radio-buttons-group`}
        defaultValue={answer}
      >
        <FormControlLabel
          value="true"
          control={<Radio inputProps={{ required: required, readOnly: answer !== undefined }} />}
          label="Yes"
        />
        <FormControlLabel
          value="false"
          control={<Radio inputProps={{ required: required, readOnly: answer !== undefined }} />}
          label="No"
        />
      </RadioGroup>
    </>
  );
};
