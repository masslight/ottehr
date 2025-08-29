import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { useChartData } from '../../../../state';

export const MedicalDecisionMakingContainer: FC = () => {
  const { chartData } = useChartData();
  const medicalDecision = chartData?.medicalDecision?.text;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Medical Decision Making
      </Typography>
      <Typography>{medicalDecision}</Typography>
    </Box>
  );
};
