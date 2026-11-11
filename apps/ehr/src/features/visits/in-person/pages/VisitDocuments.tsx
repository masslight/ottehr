import { Paper, Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { Loader } from '../../shared/components/Loader';
import { PageTitle } from '../../shared/components/PageTitle';
import { PatientDocumentsExplorer } from '../../shared/components/patient/docs/PatientDocumentsExplorer';
import { useGetAppointmentAccessibility } from '../../shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from '../../shared/stores/appointment/appointment.store';

/**
 * Progress Note "Documents" tab: all of the patient's documents. Anything uploaded or scanned here
 * is filed against the visit.
 */
export const VisitDocuments: FC = () => {
  const { appointment, patient, encounter, selectedEncounterId, isAppointmentLoading, appointmentError } =
    useAppointmentData();

  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const effectiveEncounterId = selectedEncounterId ?? encounter?.id;

  if (isAppointmentLoading) return <Loader />;
  if (appointmentError?.message) return <Typography>Error: {appointmentError.message}</Typography>;
  if (!appointment || !patient?.id || !effectiveEncounterId) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle label="All Documents" showIntakeNotesButton={false} />
      <Paper sx={{ padding: 3 }}>
        <PatientDocumentsExplorer
          patientId={patient.id}
          patient={patient}
          uploadEncounterId={effectiveEncounterId}
          readOnly={isReadOnly}
        />
      </Paper>
    </Stack>
  );
};
