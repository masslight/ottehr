import { Box, Skeleton, TextField, Typography } from '@mui/material';
import { FC } from 'react';
import { patientScreeningQuestionsConfig } from 'utils';
import { useChartData } from '../../stores/appointment/appointment.store';
import { AdditionalQuestionEdit } from '../medical-history-tab/components/AdditionalQuestionRow';

// todo: support only boolean values, update when new question types will be required
export const AdditionalQuestionsProviderColumn: FC = () => {
  const { chartData, isChartDataLoading } = useChartData();
  const questionnaireFields = patientScreeningQuestionsConfig.fields.filter((field) => field.flowConfig);

  const getObservationValue = (observationField: string): boolean | undefined => {
    const observation = chartData?.observations?.find((obs) => obs.field === observationField);
    return typeof observation?.value === 'boolean' ? observation.value : undefined;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {questionnaireFields.length > 0 ? (
        questionnaireFields.map((field) => (
          <AdditionalQuestionEdit
            key={field.id}
            label={field.question}
            field={field.observationField}
            value={getObservationValue(field.observationField)}
            isChartDataLoading={isChartDataLoading}
          />
        ))
      ) : (
        <Typography variant="body2" color="text.secondary">
          No additional questions configured
        </Typography>
      )}
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
