import AddIcon from '@mui/icons-material/Add';
import { Box } from '@mui/material';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import { getDmeOrderCreateUrl } from 'src/features/visits/in-person/routing/helpers';
import { PageTitle } from 'src/features/visits/shared/components/PageTitle';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { DME_SECTION_TITLE } from '../components/DmeBreadcrumbs';
import { DmeOrdersTable } from '../components/DmeOrdersTable';

export const DmeOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();
  const { encounter } = useAppointmentData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  if (!appointmentId || !encounter?.id) {
    return null;
  }

  const handleCreateOrder = (): void => navigate(getDmeOrderCreateUrl(appointmentId));

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <PageTitle label={DME_SECTION_TITLE} showIntakeNotesButton={false} dataTestId={dataTestIds.dmeOrders.title} />
        {!isReadOnly && (
          <ButtonRounded
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleCreateOrder}
            sx={{ py: 1, px: 3, whiteSpace: 'nowrap' }}
            data-testid={dataTestIds.dmeOrders.newOrderButton}
          >
            New Order
          </ButtonRounded>
        )}
      </Box>
      <DmeOrdersTable
        encounterId={encounter.id}
        appointmentId={appointmentId}
        allowDelete={!isReadOnly}
        onCreateOrder={!isReadOnly ? handleCreateOrder : undefined}
      />
    </Box>
  );
};
