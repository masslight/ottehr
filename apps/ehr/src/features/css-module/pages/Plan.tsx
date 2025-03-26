import { Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { useParams } from 'react-router-dom';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import {
  DispositionCard,
  PatientInstructionsCard,
  SchoolWorkExcuseCard,
} from '../../../telemed/features/appointment/PlanTab';
import { CSSLoader } from '../components/CSSLoader';
import { useAppointment } from '../hooks/useAppointment';

interface PlanProps {
  appointmentID?: string;
}

export const Plan: FC<PlanProps> = () => {
  const { id: appointmentID } = useParams();
  const {
    resources: { appointment },
    isLoading,
    error,
  } = useAppointment(appointmentID);

  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);

  if (isLoading || isChartDataLoading) return <CSSLoader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={2}>
      <PatientInstructionsCard />
      <DispositionCard />
      <SchoolWorkExcuseCard />
    </Stack>
  );
};
