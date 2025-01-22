import React, { ReactElement, useMemo, useState } from 'react';
import { Box, CircularProgress, TextField } from '@mui/material';
import { ExamCardsNames, InPersonExamCardsNames } from 'utils';
import {
  EXAM_OBSERVATIONS_CARDS,
  IN_PERSON_EXAM_OBSERVATIONS_CARDS,
  useDeleteChartData,
  useExamObservationsStore,
  useInPersonExamObservationsStore,
  useSaveChartData,
} from '../../../../state';
import { useDebounce } from '../../../../hooks';
import { useFeatureFlags } from '../../../../../features/css-module/context/featureFlags';

type ExamCommentFieldProps<T extends ExamCardsNames | InPersonExamCardsNames = ExamCardsNames> = {
  name: T;
};

export const ExamCommentField = <T extends ExamCardsNames | InPersonExamCardsNames = ExamCardsNames>(
  props: ExamCommentFieldProps<T>
): ReactElement => {
  const { name } = props;

  const { css } = useFeatureFlags();

  /* eslint-disable react-hooks/rules-of-hooks */
  const field = css
    ? useInPersonExamObservationsStore((state) => state[name as InPersonExamCardsNames])
    : useExamObservationsStore((state) => state[name as ExamCardsNames]);
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
              data.chartData.examObservations?.forEach((exam) =>
                useExamObservationsStore.setState({ [exam.field]: exam })
              );
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
              useExamObservationsStore.setState({
                [name]: css
                  ? IN_PERSON_EXAM_OBSERVATIONS_CARDS[name as InPersonExamCardsNames]
                  : EXAM_OBSERVATIONS_CARDS[name as ExamCardsNames],
              });
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
