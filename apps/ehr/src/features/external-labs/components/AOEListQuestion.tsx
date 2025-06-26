import { InputLabel, MenuItem, Select } from '@mui/material';
import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { ControllerRenderProps, FieldValues, useFormContext } from 'react-hook-form';

interface ListQuestionProps {
  questionText: string;
  linkId: string;
  answerOption: QuestionnaireItemAnswerOption[];
  required: boolean;
  isReadOnly?: boolean;
  field: ControllerRenderProps<FieldValues, string>;
}

export const AOEListQuestion: React.FC<ListQuestionProps> = (props) => {
  // single select dropdown
  const {
    formState: { errors },
  } = useFormContext();

  const { questionText, linkId, answerOption, isReadOnly, field } = props;

  const labelId = `select-${linkId}-label`;
  return (
    <>
      <InputLabel id={labelId}>{questionText}</InputLabel>
      <Select
        {...field}
        labelId={labelId}
        id={`select-${linkId}`}
        label={questionText}
        error={!!errors[linkId]}
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
