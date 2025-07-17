import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const MedicalDecisionMakingContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

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
