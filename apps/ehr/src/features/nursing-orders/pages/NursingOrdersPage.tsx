import { Box, Stack } from '@mui/material';
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNursingOrderCreateUrl } from 'src/features/css-module/routing/helpers';
import { NursingOrdersTable, NursingOrdersTableColumn } from '../components/orders/NursingOrdersTable';
import { ButtonRounded } from '../../css-module/components/RoundedButton';
import { PageTitle } from '../../../telemed/components/PageTitle';
import { useAppointmentStore } from '../../../telemed/state/appointment/appointment.store';

const nursingOrdersColumns: NursingOrdersTableColumn[] = ['order', 'orderAdded', 'status'];

export const NursingOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const appointmentId = useAppointmentStore((state) => state.appointment?.id);
  const encounterId = useAppointmentStore((state) => state.encounter?.id);

  const handleCreateOrder = useCallback((): void => {
    if (!appointmentId) {
      console.error('No appointment ID found');
      return;
    }

    navigate(getNursingOrderCreateUrl(appointmentId));
  }, [navigate, appointmentId]);

  if (!appointmentId) {
    console.error('No appointment ID found');
    return null;
  }

  if (!encounterId) {
    console.error('No encounter ID found');
    return null;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <PageTitle label="Nursing Orders" showIntakeNotesButton={false} />
        <Stack direction="row" spacing={2} alignItems="center">
          <ButtonRounded
            variant="contained"
            color="primary"
            size={'medium'}
            onClick={() => handleCreateOrder()}
            sx={{
              py: 1,
              px: 5,
            }}
          >
            Order
          </ButtonRounded>
        </Stack>
      </Box>
      <NursingOrdersTable columns={nursingOrdersColumns} allowDelete={true} />
    </Box>
  );
};
