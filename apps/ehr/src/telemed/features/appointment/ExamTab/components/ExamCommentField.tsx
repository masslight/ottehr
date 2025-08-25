import { Box, CircularProgress, TextField } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { useDebounce } from '../../../../hooks';
import { useExamObservations } from '../../../../hooks/useExamObservations';

type ExamCommentFieldProps = {
  name: string;
  dataTestId?: string;
};

export const ExamCommentField = (props: ExamCommentFieldProps): ReactElement => {
  const { name, dataTestId } = props;

  const { value: field, update, delete: deleteField, isLoading } = useExamObservations(name);

  const { debounce } = useDebounce(700);

  const onChange = (value: string): void => {
    value = value.trim();

    debounce(() => {
      if (value) {
        update({ ...field, field: name, note: value });
      } else {
        deleteField(field);
      }
    });
  };

  const [value, setValue] = useState(field?.note || '');

  useEffect(() => {
    if (field?.note?.trim() !== value.trim()) {
      // update UI value only if it's different from the field value
      setValue(field?.note || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field?.note]);

  return (
    <TextField
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        onChange(e.target.value);
      }}
      size="small"
      data-testid={dataTestId}
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
