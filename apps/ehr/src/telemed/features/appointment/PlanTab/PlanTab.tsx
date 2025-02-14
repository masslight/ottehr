import { Box, CircularProgress } from '@mui/material';
import { FC } from 'react';
import useEvolveUser from '../../../../hooks/useEvolveUser';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { DispositionCard } from './DispositionCard';
import { ERxCard } from './ERxCard';
import { ERxContainer } from './ERxContainer';
import { HealthwiseDocumentsCard } from './HealthwiseDocumentsCard';
import { PatientInstructionsCard } from './PatientInstructionsCard';
import { SchoolWorkExcuseCard } from './SchoolWorkExcuseCard';

export const PlanTab: FC = () => {
  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);
  const user = useEvolveUser();

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
      {user?.isPractitionerEnrolledInPhoton && <ERxContainer />}
      {user?.isPractitionerEnrolledInPhoton && <ERxCard />}
      <PatientInstructionsCard />
      {tmpHideHealthwiseDocuments ? <></> : <HealthwiseDocumentsCard />}
      <DispositionCard />
      <SchoolWorkExcuseCard />
    </Box>
  );
};
