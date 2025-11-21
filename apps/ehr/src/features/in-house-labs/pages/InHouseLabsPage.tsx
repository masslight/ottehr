import { Box, Stack } from '@mui/material';
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ListViewContainer from 'src/features/common/ListViewContainer';
import { getInHouseLabOrderCreateUrl } from 'src/features/visits/in-person/routing/helpers';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { dataTestIds } from '../../../constants/data-test-ids';
import { ButtonRounded } from '../../visits/in-person/components/RoundedButton';
import { PageTitle } from '../../visits/shared/components/PageTitle';
import { InHouseLabsTable, InHouseLabsTableColumn } from '../components/orders/InHouseLabsTable';

const inHouseLabsColumns: InHouseLabsTableColumn[] = ['testType', 'orderAdded', 'provider', 'dx', 'status', 'actions'];

export const InHouseLabsPage: React.FC = () => {
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

    navigate(getInHouseLabOrderCreateUrl(appointmentId));
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
    <ListViewContainer>
      <>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <PageTitle
            dataTestId={dataTestIds.inHouseLabsPage.title}
            label="In-House Labs"
            showIntakeNotesButton={false}
          />
          <Stack direction="row" spacing={2} alignItems="center">
            {!isReadOnly && (
              <ButtonRounded
                data-testid={dataTestIds.inHouseLabsPage.orderButton}
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
        <InHouseLabsTable
          searchBy={{ searchBy: { field: 'encounterId', value: encounterId } }}
          columns={inHouseLabsColumns}
          showFilters={false}
          allowDelete={!isReadOnly}
          onCreateOrder={!isReadOnly ? handleCreateOrder : undefined}
        />
      </>
    </ListViewContainer>
  );
};
