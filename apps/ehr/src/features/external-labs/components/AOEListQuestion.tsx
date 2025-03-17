import { Select, MenuItem, InputLabel } from '@mui/material';
import { ControllerRenderProps, FieldValues, useFormContext } from 'react-hook-form';
import { AoeAnswerOption } from '../pages/OrderDetails';

interface ListQuestionProps {
  questionText: string;
  linkId: string;
  answerOption: AoeAnswerOption[];
  required: boolean;
  field: ControllerRenderProps<FieldValues, string>;
}

export const AOEListQuestion: React.FC<ListQuestionProps> = (props) => {
  // single select dropdown
  const {
    formState: { errors },
  } = useFormContext();

  const { questionText, linkId, answerOption, field } = props;

  const labelId = `select-${linkId}-label`;
  return (
    <>
      <InputLabel id={labelId}>{questionText}</InputLabel>
      <Select {...field} labelId={labelId} id={`select-${linkId}`} label={questionText} error={!!errors[linkId]}>
        {answerOption.map((option, idx) => (
          <MenuItem key={idx} value={option.valueString}>
            {option.valueString}
          </MenuItem>
        ))}
      </Select>
    </>
  );
};
