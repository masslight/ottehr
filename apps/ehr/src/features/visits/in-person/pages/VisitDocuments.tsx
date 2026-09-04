import { Paper, Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { Loader } from '../../shared/components/Loader';
import { PageTitle } from '../../shared/components/PageTitle';
import { PatientDocumentsExplorer } from '../../shared/components/patient/docs/PatientDocumentsExplorer';
import { useGetAppointmentAccessibility } from '../../shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from '../../shared/stores/appointment/appointment.store';

/**
 * Progress Note "Documents" tab: the patient's documents narrowed to this visit. Anything uploaded
 * or scanned here is filed against the visit.
 */
export const VisitDocuments: FC = () => {
  const {
    appointment,
    patient,
    encounter,
    selectedEncounterId,
    followUpOriginEncounter,
    isAppointmentLoading,
    appointmentError,
  } = useAppointmentData();

  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const effectiveEncounterId = selectedEncounterId ?? encounter?.id;

  // The appointment id must belong to the encounter being viewed, or a switched-to follow-up would
  // pull in the origin visit's intake documents through the appointment linkage. The store only
  // re-resolves `appointment` for a follow-up when that Appointment happens to be loaded, so take
  // the encounter's own reference as the source of truth and fall back to the page's appointment
  // only while the origin encounter is selected.
  const isOriginEncounterSelected = !selectedEncounterId || selectedEncounterId === followUpOriginEncounter?.id;
  const encounterAppointmentId = removePrefix('Appointment/', encounter?.appointment?.[0]?.reference ?? '');
  const effectiveAppointmentId = encounterAppointmentId ?? (isOriginEncounterSelected ? appointment?.id : undefined);

  if (isAppointmentLoading) return <Loader />;
  if (appointmentError?.message) return <Typography>Error: {appointmentError.message}</Typography>;
  if (!appointment || !patient?.id || !effectiveEncounterId) return <Typography>No data available</Typography>;

  return (
    <Stack spacing={1}>
      <PageTitle label="Visit Documents" showIntakeNotesButton={false} />
      <Paper sx={{ padding: 3 }}>
        <PatientDocumentsExplorer
          patientId={patient.id}
          // Both linkages: EHR uploads link by encounter, while consent forms, condition photos
          // and school/work notes from intake link by appointment.
          visit={{ encounterId: effectiveEncounterId, appointmentId: effectiveAppointmentId }}
          readOnly={isReadOnly}
        />
      </Paper>
    </Stack>
  );
};
