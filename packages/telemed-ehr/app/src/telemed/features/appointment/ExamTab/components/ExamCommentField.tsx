import React, { FC, useMemo, useState } from 'react';
import { Box, CircularProgress, TextField } from '@mui/material';
import { ExamCardsNames } from 'ehr-utils';
import {
  EXAM_OBSERVATIONS_CARDS,
  useDeleteChartData,
  useExamObservationsStore,
  useSaveChartData,
} from '../../../../state';
import { useDebounce } from '../../../../hooks';

type ExamCommentFieldProps = {
  name: ExamCardsNames;
};

export const ExamCommentField: FC<ExamCommentFieldProps> = (props) => {
  const { name } = props;

  const field = useExamObservationsStore((state) => state[name]);
  const [value, setValue] = useState(field.note || '');

  const { mutate: saveChartData, isLoading: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isLoading: isDeleteLoading } = useDeleteChartData();

  const isLoading = useMemo(() => isSaveLoading || isDeleteLoading, [isSaveLoading, isDeleteLoading]);

  const { debounce } = useDebounce();

  const onValueChange = (text: string): void => {
    debounce(() => {
      text = text.trim();

      if (text) {
        saveChartData(
          {
            examObservations: [{ ...field, note: text }],
          },
          {
            onSuccess: (data) => {
              data.examObservations?.forEach((exam) => useExamObservationsStore.setState({ [exam.field]: exam }));
            },
          }
        );
      } else {
        deleteChartData(
          {
            examObservations: [{ ...field, note: text }],
          },
          {
            onSuccess: (_data) => {
              useExamObservationsStore.setState({ [name]: EXAM_OBSERVATIONS_CARDS[name] });
            },
          }
        );
      }
    });
  };

  return (
    <TextField
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        onValueChange(e.target.value);
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
