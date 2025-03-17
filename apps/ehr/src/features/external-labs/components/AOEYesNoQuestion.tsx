import { FormLabel, RadioGroup, FormControlLabel, Radio } from '@mui/material';
import { ControllerRenderProps, FieldValues, useFormContext } from 'react-hook-form';

interface YesNoQuestionProps {
  questionText: string;
  linkId: string;
  required: boolean;
  field: ControllerRenderProps<FieldValues, string>;
}

export const AOEYesNoQuestion: React.FC<YesNoQuestionProps> = (props) => {
  // single select dropdown
  const {
    formState: { errors: _ },
  } = useFormContext();

  const { questionText, linkId, required: _r, field } = props;

  const labelId = `boolean-${linkId}-label`;
  return (
    <>
      <FormLabel id={labelId}>{questionText}</FormLabel>
      <RadioGroup {...field} row aria-labelledby="demo-row-radio-buttons-group-label" name="row-radio-buttons-group">
        <FormControlLabel value="true" control={<Radio />} label="Yes" />
        <FormControlLabel value="false" control={<Radio />} label="No" />
      </RadioGroup>
    </>
  );
};
