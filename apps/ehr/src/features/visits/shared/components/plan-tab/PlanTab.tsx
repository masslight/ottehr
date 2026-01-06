import { Box, CircularProgress } from '@mui/material';
import { FC } from 'react';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { useChartData } from '../../stores/appointment/appointment.store';
import { DispositionCard } from '../DispositionCard';
import { FormsCard } from '../FormsCard';
import { SchoolWorkExcuseCard } from '../SchoolWorkExcuseCard';
import { ERxCard } from './ERxCard';
import { HealthwiseDocumentsCard } from './HealthwiseDocumentsCard';
import { PatientInstructionsCard } from './PatientInstructionsCard';

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
      {FEATURE_FLAGS.FORMS_ENABLED && <FormsCard />}
    </Box>
  );
};
