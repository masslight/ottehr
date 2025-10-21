import { Box, Stack } from '@mui/material';
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNursingOrderCreateUrl } from 'src/features/visits/in-person/routing/helpers';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { ButtonRounded } from '../../visits/in-person/components/RoundedButton';
import { PageTitle } from '../../visits/shared/components/PageTitle';
import { NursingOrdersTable, NursingOrdersTableColumn } from '../components/orders/NursingOrdersTable';

const nursingOrdersColumns: NursingOrdersTableColumn[] = ['order', 'orderAdded', 'status'];

export const NursingOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { appointment, encounter } = useAppointmentData();
  const appointmentId = appointment?.id;
  const encounterId = encounter?.id;
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const handleCreateOrder = useCallback((): void => {
    if (!appointmentId) {
      console.error('No appointment ID found');
      return;
    }

    navigate(getNursingOrderCreateUrl(appointmentId));
  }, [navigate, appointmentId]);

  if (!appointmentId || !encounterId) {
    return null;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <PageTitle label="Nursing Orders" showIntakeNotesButton={false} />
        <Stack direction="row" spacing={2} alignItems="center">
          {!isReadOnly && (
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
          )}
        </Stack>
      </Box>
      <NursingOrdersTable
        columns={nursingOrdersColumns}
        searchBy={{ field: 'encounterId', value: encounterId }}
        appointmentId={appointmentId}
        allowDelete={!isReadOnly}
      />
    </Box>
  );
};
