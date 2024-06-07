import React, { FC } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { AssessmentCard } from './AssessmentCard';
import { ERxCard } from './ERxCard';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';

export const AssessmentTab: FC = () => {
  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);

  if (isChartDataLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <AssessmentCard />
      <ERxCard />
    </Box>
  );
};
