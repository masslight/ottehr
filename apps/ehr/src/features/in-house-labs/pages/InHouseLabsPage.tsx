import { Box, Stack } from '@mui/material';
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTitle } from '../../../telemed/components/PageTitle';
import { useAppointmentStore } from '../../../telemed/state/appointment/appointment.store';
import { ButtonRounded } from '../../css-module/components/RoundedButton';
import { InHouseLabsTable, InHouseLabsTableColumn } from '../comonents/orders/InHouseLabsTable';
import { getInHouseLabOrderCreateUrl } from 'src/features/css-module/routing/helpers';

const inHouseLabsColumns: InHouseLabsTableColumn[] = [
  'testType',
  'visit',
  'orderAdded',
  'provider',
  'dx',
  'resultsReceived',
  'status',
];

export const InHouseLabsPage: React.FC = () => {
  const navigate = useNavigate();
  const appointmentId = useAppointmentStore((state) => state.appointment?.id);
  const encounterId = useAppointmentStore((state) => state.encounter?.id);

  const handleCreateOrder = useCallback(
    ({ _isAutoRedirected }: { _isAutoRedirected?: boolean } = {}): void => {
      if (!appointmentId) {
        console.error('No appointment ID found');
        return;
      }

      navigate(getInHouseLabOrderCreateUrl(appointmentId));
    },
    [navigate, appointmentId]
  );

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
        <PageTitle label="In-House Labs" showIntakeNotesButton={false} />
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
      <InHouseLabsTable
        searchBy={{ searchBy: { field: 'encounterId', value: encounterId } }}
        columns={inHouseLabsColumns}
        showFilters={true}
        allowDelete={false}
      />
    </Box>
  );
};
