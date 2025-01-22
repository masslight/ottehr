import React, { FC, useState } from 'react';
import { Box, Dialog, IconButton, Link, Skeleton, Typography } from '@mui/material';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../state';

import CloseIcon from '@mui/icons-material/Close';
import { getPatientName } from '../../utils';
import { useGetPatient } from '../../../hooks/useGetPatient';
import { PastVisitsTable } from '../../components/PastVisitsTable';

export const PastVisits: FC = () => {
  const { patient } = getSelectors(useAppointmentStore, ['patient']);
  const { appointments, loading } = useGetPatient(patient?.id);
  const [open, setOpen] = useState(false);

  const patientName = getPatientName(patient?.name).lastFirstName;

  if (loading) {
    return <Skeleton sx={{ display: 'inline-block' }} variant="text" width={100} />;
  }

  if (!appointments?.length) {
    return <Typography variant="body2">New patient</Typography>;
  }

  return (
    <>
      <Typography variant="body2">
        Established patient:{' '}
        <Link sx={{ cursor: 'pointer', color: 'inherit' }} onClick={() => setOpen(true)}>
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
