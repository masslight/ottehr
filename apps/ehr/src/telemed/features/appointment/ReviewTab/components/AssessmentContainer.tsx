import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { useChartData } from '../../../../state';
import { AssessmentTitle } from '../../AssessmentTab';

export const AssessmentContainer: FC = () => {
  const { chartData } = useChartData();

  const diagnoses = chartData?.diagnosis;
  const primaryDiagnosis = diagnoses?.find((item) => item.isPrimary);
  const otherDiagnoses = diagnoses?.filter((item) => !item.isPrimary);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Assessment
      </Typography>
      <>
        {primaryDiagnosis && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <AssessmentTitle>Primary:</AssessmentTitle>
            <Typography>
              {primaryDiagnosis.display} {primaryDiagnosis.code}
            </Typography>
          </Box>
        )}
        {otherDiagnoses && otherDiagnoses.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <AssessmentTitle>Secondary:</AssessmentTitle>
            {otherDiagnoses.map((diagnosis) => (
              <Typography key={diagnosis.resourceId}>
                {diagnosis.display} {diagnosis.code}
              </Typography>
            ))}
          </Box>
        )}
      </>
    </Box>
  );
};
