import { Grid, Typography } from '@mui/material';
import { FC, useMemo, useState } from 'react';
import { getFullName, mdyStringFromISOString } from 'utils';
import { useAppointmentData } from '../../../shared/stores/appointment/appointment.store';
import { EditPatientNameDialog } from './EditPatientNameDialog';
import { PencilIconButton } from './PencilIconButton';

export const TitleRow: FC = () => {
  const { patient, appointment, locationVirtual } = useAppointmentData();

  const fullName = useMemo(() => {
    if (patient) {
      return getFullName(patient);
    }
    return '';
  }, [patient]);

  const visitStarted = appointment?.start && mdyStringFromISOString(appointment?.start);

  const office =
    locationVirtual?.address?.state &&
    locationVirtual?.name &&
    `${locationVirtual?.name}, ${locationVirtual?.address?.state.toUpperCase()}`;

  const [updateNameModalOpen, setUpdateNameModalOpen] = useState<boolean>(false);
  const closePatientNameModal = (): void => setUpdateNameModalOpen(false);

  return (
    <>
      <Grid container direction="row" sx={{ mt: 1, alignItems: 'center' }}>
        <PencilIconButton onClick={() => setUpdateNameModalOpen(true)} size="25px" sx={{ mr: '7px', padding: 0 }} />
        <Typography variant="h2" color="primary.dark">
          {fullName}
        </Typography>

        <Typography sx={{ ml: 2 }}>{visitStarted}</Typography>

        <Typography sx={{ ml: 2 }}>{office}</Typography>
      </Grid>
      <EditPatientNameDialog modalOpen={updateNameModalOpen} onClose={closePatientNameModal} />
    </>
  );
};
