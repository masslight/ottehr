import { Box, Skeleton, TextField, Typography } from '@mui/material';
import { FC } from 'react';
import { patientScreeningQuestionsConfig } from 'utils';
import { useChartData } from '../../stores/appointment/appointment.store';
import { AdditionalQuestionEdit } from '../medical-history-tab/components/AdditionalQuestionRow';

export const AdditionalQuestionsProviderColumn: FC = () => {
  const { chartData, isChartDataLoading } = useChartData();
  const questionnaireFields = patientScreeningQuestionsConfig.fields.filter((field) => field.existsInQuestionnaire);

  const getObservationValue = (fhirField: string): boolean | string | undefined => {
    const observation = chartData?.observations?.find((obs) => obs.field === fhirField);
    const value = observation?.value;
    return typeof value === 'boolean' || typeof value === 'string' ? value : undefined;
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
            field={field.fhirField}
            value={getObservationValue(field.fhirField)}
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
