import { Box, Stack } from '@mui/material';
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTitle } from '../../../telemed/components/PageTitle';
import { useAppointmentStore } from '../../../telemed/state/appointment/appointment.store';
import { ButtonRounded } from '../../css-module/components/RoundedButton';
import { LabsTable, LabsTableColumn } from '../components/labs-orders/LabsTable';
import { AUTO_REDIRECTED_PARAM } from 'utils/lib/types/data/labs/labs.constants';

const externalLabsColumns: LabsTableColumn[] = ['testType', 'orderAdded', 'provider', 'dx', 'status', 'psc', 'actions'];

export const ExternalLabOrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const encounterId = useAppointmentStore((state) => state.encounter?.id);

  const handleCreateOrder = useCallback(
    ({ isAutoRedirected }: { isAutoRedirected?: boolean } = {}): void => {
      const params = isAutoRedirected ? `?${AUTO_REDIRECTED_PARAM}` : '';
      navigate(`create${params}`);
    },
    [navigate]
  );

  if (!encounterId) {
    console.error('No encounter ID found');
    return null;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <PageTitle label="Labs" showIntakeNotesButton={false} />
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
      <LabsTable
        searchBy={{ searchBy: { field: 'encounterId', value: encounterId } }}
        columns={externalLabsColumns}
        showFilters={false}
        allowDelete={true}
        redirectToOrderCreateIfOrdersEmpty={true}
        onCreateOrder={handleCreateOrder}
      />
    </Box>
  );
};
