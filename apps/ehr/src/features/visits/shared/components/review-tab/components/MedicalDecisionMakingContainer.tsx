import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { useChartFields } from '../../../hooks/useChartFields';

export const MedicalDecisionMakingContainer: FC = () => {
  const { data: chartFields } = useChartFields({
    requestedFields: {
      medicalDecision: {
        _tag: 'medical-decision',
      },
    },
  });
  const medicalDecision = chartFields?.medicalDecision?.text;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Medical Decision Making
      </Typography>
      <Typography>{medicalDecision}</Typography>
    </Box>
  );
};
