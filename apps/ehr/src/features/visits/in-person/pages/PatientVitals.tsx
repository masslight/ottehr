import { Stack, Typography } from '@mui/material';
import React from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { SystemReportsPlace } from 'src/features/system-reports/SystemReportsPlace';
import { PageTitle } from 'src/features/visits/shared/components/PageTitle';
import { Loader } from '../../shared/components/Loader';
import { useChartData } from '../../shared/hooks/useChartData';
import { useAppointmentData } from '../../shared/stores/appointment/appointment.store';
import { PatientVitalsBody } from '../components/vitals/PatientVitalsBody';
import { useInPersonNavigationContext } from '../context/InPersonNavigationContext';

interface PatientVitalsProps {
  appointmentID?: string;
}

export const PatientVitals: React.FC<PatientVitalsProps> = () => {
  const {
    resources: { appointment, patient, encounter },
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isChartDataLoading, chartDataError } = useChartData();
  const isLoading = isAppointmentLoading || isChartDataLoading;
  const error = chartDataError || appointmentError;

  const { interactionMode } = useInPersonNavigationContext();

  if (isLoading) return <Loader />;
  if (error) return <Typography>Error: {error.message}</Typography>;
  if (!appointment) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle
        label="Vitals"
        showIntakeNotesButton={interactionMode === 'main'}
        dataTestId={dataTestIds.vitalsPage.title}
      />
      <SystemReportsPlace
        place="visit.vitals"
        pageTab="Enter vitals"
        inputs={{ patientId: patient?.id, encounterId: encounter?.id, visitDate: appointment.start }}
        patient={{ birthDate: patient?.birthDate }}
      >
        <PatientVitalsBody />
      </SystemReportsPlace>
    </Stack>
  );
};
