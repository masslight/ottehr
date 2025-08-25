import { Box, CircularProgress } from '@mui/material';
import { FC } from 'react';
import { useChartData } from '../../../state';
import { DispositionCard } from './DispositionCard';
import { ERxCard } from './ERxCard';
import { HealthwiseDocumentsCard } from './HealthwiseDocumentsCard';
import { PatientInstructionsCard } from './PatientInstructionsCard';
import { SchoolWorkExcuseCard } from './SchoolWorkExcuseCard';

export const PlanTab: FC = () => {
  const { isChartDataLoading } = useChartData();

  if (isChartDataLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  // 1656: temporarily hide HealthwiseDocuments section
  const tmpHideHealthwiseDocuments = true;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <ERxCard />
      <PatientInstructionsCard />
      {tmpHideHealthwiseDocuments ? <></> : <HealthwiseDocumentsCard />}
      <DispositionCard />
      <SchoolWorkExcuseCard />
    </Box>
  );
};
