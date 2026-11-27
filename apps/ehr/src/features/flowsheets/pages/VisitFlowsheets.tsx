import { Stack, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { Loader } from 'src/features/visits/shared/components/Loader';
import { PageTitle } from 'src/features/visits/shared/components/PageTitle';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { Flowsheets } from '../components/Flowsheets';
import { FlowsheetUnitToggle, useFlowsheetUnitSystem } from '../components/FlowsheetUnitToggle';

export const VisitFlowsheets = (): ReactElement => {
  const {
    resources: { patient },
    encounter,
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();
  const [unitSystem, setUnitSystem] = useFlowsheetUnitSystem();

  if (isAppointmentLoading) return <Loader />;
  if (appointmentError) return <Typography>Error: {appointmentError.message}</Typography>;
  if (!patient?.id) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle
        label="Flowsheets"
        showIntakeNotesButton={false}
        actions={<FlowsheetUnitToggle value={unitSystem} onChange={setUnitSystem} />}
      />
      <Flowsheets patientId={patient.id} currentEncounterId={encounter?.id} unitSystem={unitSystem} />
    </Stack>
  );
};
