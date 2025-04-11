import { FormLabel, RadioGroup, FormControlLabel, Radio } from '@mui/material';
import { ControllerRenderProps, FieldValues, useFormContext } from 'react-hook-form';

interface YesNoQuestionProps {
  questionText: string;
  linkId: string;
  required: boolean;
  field: ControllerRenderProps<FieldValues, string>;
}

export const AOEYesNoQuestion: React.FC<YesNoQuestionProps> = (props) => {
  const {
    formState: { errors: _ },
  } = useFormContext();

  const { questionText, linkId, required, field } = props;

  const labelId = `boolean-${linkId}-label`;
  return (
    <>
      <FormLabel id={labelId}>{questionText}</FormLabel>
      <RadioGroup {...field} row aria-labelledby={labelId} name={`${labelId}-row-radio-buttons-group`}>
        <FormControlLabel value="true" control={<Radio inputProps={{ required: required }} />} label="Yes" />
        <FormControlLabel value="false" control={<Radio inputProps={{ required: required }} />} label="No" />
      </RadioGroup>
    </>
  );
};
