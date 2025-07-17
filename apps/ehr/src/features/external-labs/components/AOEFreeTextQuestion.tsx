import { TextField } from '@mui/material';
import { ControllerRenderProps, FieldValues, useFormContext } from 'react-hook-form';
interface FreeTextQuestionProps {
  questionText: string;
  linkId: string;
  required: boolean;
  isReadOnly?: boolean;
  field: ControllerRenderProps<FieldValues, string>;
}

export const AOEFreeTextQuestion: React.FC<FreeTextQuestionProps> = (props) => {
  // free text field
  const {
    formState: { errors },
  } = useFormContext();

  const { questionText, linkId, required, isReadOnly, field } = props;

  return (
    <TextField
      {...field}
      id={`free-text-${linkId}`}
      label={questionText}
      sx={{ width: '100%' }}
      required={required}
      error={!!errors[linkId]}
      // max length for labs input is 150 chararacters https://github.com/masslight/ottehr/issues/2467
      inputProps={{ readOnly: isReadOnly, maxLength: 150 }}
    />
  );
};
