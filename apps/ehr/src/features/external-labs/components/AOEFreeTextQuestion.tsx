import { TextField, FormControl } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
interface FreeTextQuestionProps {
  questionText: string;
  linkId: string;
  required: boolean;
}

export const AOEFreeTextQuestion: React.FC<FreeTextQuestionProps> = (props) => {
  // free text field
  const {
    control,
    formState: { errors },
  } = useFormContext();

  const { questionText, linkId, required } = props;

  return (
    <Controller
      name={linkId}
      control={control}
      defaultValue={''}
      render={({ field }) => (
        <FormControl fullWidth error={!!errors[linkId]} required={required}>
          <TextField
            {...field}
            id={`free-text-${linkId}`}
            label={questionText}
            sx={{ width: '100%' }}
            required={required}
            error={!!errors[linkId]}
          />
          {/* {isError && <FormHelperText>Required</FormHelperText>} */}
        </FormControl>
      )}
    />
  );
};
