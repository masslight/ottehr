import CloseIcon from '@mui/icons-material/Close';
import { Box, Dialog, IconButton, Link, Skeleton, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FC, useState } from 'react';
import { PastVisitsTable } from 'src/components/PastVisitsTable';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetPatient } from 'src/hooks/useGetPatient';
import { getPatientName } from 'src/shared/utils/getPatientName';
import { PatientVisitListResponse } from 'utils';

export const PastVisits: FC = () => {
  const { patient } = useAppointmentData();
  const { loading } = useGetPatient(patient?.id);
  const [open, setOpen] = useState(false);

  const patientName = getPatientName(patient?.name).fullDisplayName;

  const { oystehrZambda } = useApiClients();

  const { data: visitHistory } = useQuery({
    queryKey: [`get-patient-visit-history`, { patientId: patient?.id }],
    queryFn: async (): Promise<PatientVisitListResponse> => {
      if (oystehrZambda && patient?.id) {
        const result = await oystehrZambda.zambda.execute({
          id: 'get-patient-visit-history',
          patientId: patient.id,
        });
        return result.output as PatientVisitListResponse;
      }

      throw new Error('api client not defined or patient id is not provided');
    },
    enabled: Boolean(patient?.id) && Boolean(oystehrZambda),
  });

  const appointments = visitHistory?.visits ?? [];

  if (loading) {
    return <Skeleton sx={{ display: 'inline-block' }} variant="text" width={100} />;
  }

  if (!appointments?.length || appointments.length == 1) {
    return (
      <Typography data-testid={dataTestIds.telemedEhrFlow.telemedNewOrExistingPatient} variant="body2">
        New patient
      </Typography>
    );
  }

  return (
    <>
      <Typography variant="body2">
        Established patient:
        <Link
          sx={{ cursor: 'pointer', color: 'inherit' }}
          onClick={() => setOpen(true)}
          data-testid={dataTestIds.telemedEhrFlow.telemedNewOrExistingPatient}
        >
          {appointments.length} visit{appointments.length > 1 && 's'}
        </Link>
      </Typography>

      {open && (
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
          <IconButton size="small" onClick={() => setOpen(false)} sx={{ position: 'absolute', right: 16, top: 16 }}>
            <CloseIcon fontSize="small" />
          </IconButton>

          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h4" color="primary.dark">
              Past Visits - {patientName}
            </Typography>
            <Box sx={{ maxHeight: '700px', overflowY: 'scroll' }}>
              <PastVisitsTable appointments={appointments} stickyHeader />
            </Box>
          </Box>
        </Dialog>
      )}
    </>
  );
};
