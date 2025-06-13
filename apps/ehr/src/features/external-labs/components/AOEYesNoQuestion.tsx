import { FormLabel, RadioGroup, FormControlLabel, Radio } from '@mui/material';
import { otherColors } from '@ehrTheme/colors';
import { ControllerRenderProps, FieldValues, useFormContext } from 'react-hook-form';

interface YesNoQuestionProps {
  questionText: string;
  linkId: string;
  answer?: string;
  required: boolean;
  field: ControllerRenderProps<FieldValues, string>;
}

const radioStyles = {
  '&.Mui-disabled': {
    color: 'primary.main',
  },
  '& .MuiSvgIcon-root': {
    color: 'primary.main',
  },
};

const labelStyles = {
  '&.Mui-disabled .MuiTypography-root': {
    color: otherColors.tableRow,
  },
  '&.MuiFormControlLabel-root.Mui-disabled .MuiTypography-root': {
    color: otherColors.tableRow,
  },
};

// cSpell:disable-next AOEYes
export const AOEYesNoQuestion: React.FC<YesNoQuestionProps> = (props) => {
  const {
    formState: { errors: _ },
  } = useFormContext();

  const { questionText, linkId, answer, required, field } = props;
  const isReadOnly = answer !== undefined;
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
          control={<Radio disabled={isReadOnly} inputProps={{ required: required }} sx={radioStyles} />}
          label="Yes"
          sx={labelStyles}
        />
        <FormControlLabel
          value="false"
          control={<Radio disabled={isReadOnly} inputProps={{ required: required }} sx={radioStyles} />}
          label="No"
          sx={labelStyles}
        />
      </RadioGroup>
    </>
  );
};
