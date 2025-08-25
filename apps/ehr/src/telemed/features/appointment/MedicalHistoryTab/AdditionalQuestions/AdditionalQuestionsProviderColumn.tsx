import { Box, Divider, Skeleton, TextField } from '@mui/material';
import React, { FC } from 'react';
import { ObservationBooleanFieldDTO } from 'utils';
import { ADDITIONAL_QUESTIONS } from '../../../../../constants';
import { useGetAppointmentAccessibility } from '../../../../hooks';
import { useChartData } from '../../../../state';
import { AdditionalQuestionEdit, AdditionalQuestionView } from '../components';

export const AdditionalQuestionsProviderColumn: FC = () => {
  const { chartData, isChartDataLoading } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {ADDITIONAL_QUESTIONS.map((question, index) => {
        const value = (
          chartData?.observations?.find(
            (observation) => observation.field === question.field
          ) as ObservationBooleanFieldDTO
        )?.value;
        return (
          <React.Fragment key={question.field}>
            {isReadOnly ? (
              <AdditionalQuestionView
                label={question.label}
                value={value}
                isLoading={isChartDataLoading}
                field={question.field}
              />
            ) : (
              <AdditionalQuestionEdit
                label={question.label}
                field={question.field}
                value={value}
                isChartDataLoading={isChartDataLoading}
              />
            )}
            {index < ADDITIONAL_QUESTIONS.length - 1 && <Divider />}
          </React.Fragment>
        );
      })}
    </Box>
  );
};

export const AdditionalQuestionsProviderColumnSkeleton: FC = () => {
  return (
    <Skeleton variant="rounded" width="100%">
      <TextField multiline rows={3} />
    </Skeleton>
  );
};
