import { Box, CircularProgress, TextField } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { ExamCardsNames, InPersonExamCardsNames } from 'utils';
import { useDebounce } from '../../../../hooks';
import { useExamObservations } from '../../../../hooks/useExamObservations';

type ExamCommentFieldProps<T extends ExamCardsNames | InPersonExamCardsNames = ExamCardsNames> = {
  name: T;
};

export const ExamCommentField = <T extends ExamCardsNames | InPersonExamCardsNames = ExamCardsNames>(
  props: ExamCommentFieldProps<T>
): ReactElement => {
  const { name } = props;

  const { value: field, update, delete: deleteField, isLoading } = useExamObservations(name);

  const { debounce } = useDebounce();

  const onChange = (value: string): void => {
    value = value.trim();

    if (value) {
      debounce(() => {
        update({ ...field, note: value });
      });
    } else {
      deleteField(field);
    }
  };

  const [value, setValue] = useState(field.note || '');

  useEffect(() => {
    setValue(field.note || '');
  }, [field.note]);

  return (
    <TextField
      value={value}
      onChange={(e) => {
        console.log('e.target.value', e.target.value);
        setValue(e.target.value);
        onChange(e.target.value);
      }}
      size="small"
      label="Provider comment"
      fullWidth
      InputProps={{
        endAdornment: isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size="20px" />
          </Box>
        ),
      }}
    />
  );
};
