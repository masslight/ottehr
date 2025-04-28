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

  const styledRadio = (
    <Radio
      disabled={answer !== undefined} // readyonly doesnt work for radio buttons
      inputProps={{ required: required }}
      // override disabled styling
      sx={{
        '&.Mui-disabled': {
          color: 'black',
        },
        '&.Mui-checked.Mui-disabled': {
          color: 'blue',
        },
      }}
    />
  );
  const overrideRadioDisabledStyling = { '.MuiFormControlLabel-label.Mui-disabled': { color: 'black' } };

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
        <FormControlLabel value="true" label="Yes" control={styledRadio} sx={overrideRadioDisabledStyling} />
        <FormControlLabel value="false" label="No" control={styledRadio} sx={overrideRadioDisabledStyling} />
      </RadioGroup>
    </>
  );
};
