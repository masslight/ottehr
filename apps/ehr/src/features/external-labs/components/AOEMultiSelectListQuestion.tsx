import { Box, Chip, InputLabel, MenuItem, OutlinedInput, Select } from '@mui/material';
import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { ControllerRenderProps, FieldValues, useFormContext } from 'react-hook-form';

interface MultiListQuestionProps {
  questionText: string;
  linkId: string;
  answerOption: QuestionnaireItemAnswerOption[];
  required: boolean;
  isReadOnly?: boolean;
  field: ControllerRenderProps<FieldValues, string>;
}

export const AOEMultiSelectListQuestion: React.FC<MultiListQuestionProps> = (props) => {
  // multi select dropdown
  const {
    formState: { errors },
  } = useFormContext();

  const { questionText, linkId, answerOption, isReadOnly, field } = props;

  const labelId = `multi-select-${linkId}-label`;
  return (
    <>
      <InputLabel id={labelId}>{questionText}</InputLabel>
      <Select
        {...field}
        labelId={labelId}
        id={`multi-select-${linkId}`}
        label={questionText}
        multiple
        error={!!errors[linkId]}
        input={<OutlinedInput id="select-multiple-chip" label={questionText} />} // the label here has to match the label on the input and select otherwise the label won't size properly
        renderValue={(selected: any[]) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selected?.map((value: string, idx: number) => <Chip key={idx} label={value} />)}
          </Box>
        )}
        readOnly={isReadOnly}
      >
        {answerOption.map((option, idx) => (
          <MenuItem key={idx} value={option.valueString}>
            {option.valueString}
          </MenuItem>
        ))}
      </Select>
    </>
  );
};
