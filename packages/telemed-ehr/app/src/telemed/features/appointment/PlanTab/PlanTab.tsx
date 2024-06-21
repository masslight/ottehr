import React, { FC } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { PatientInstructionsCard } from './PatientInstructionsCard';
import { HealthwiseDocumentsCard } from './HealthwiseDocumentsCard';
import { DispositionCard } from './DispositionCard';
import { WorkSchoolExcuseCard } from './WorkSchoolExcuseCard';

export const PlanTab: FC = () => {
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
      <PatientInstructionsCard />
      <HealthwiseDocumentsCard />
      <DispositionCard />
      <WorkSchoolExcuseCard />
    </Box>
  );
};
