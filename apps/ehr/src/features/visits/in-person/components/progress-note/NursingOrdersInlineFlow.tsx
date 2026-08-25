import { Box, Stack } from '@mui/material';
import { FC, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  NursingOrdersTable,
  NursingOrdersTableColumn,
} from 'src/features/nursing-orders/components/orders/NursingOrdersTable';
import { NursingOrderCreatePage } from 'src/features/nursing-orders/pages/NursingOrderCreatePage';
import { NursingOrderDetailsPage } from 'src/features/nursing-orders/pages/NursingOrderDetailsPage';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';

const nursingOrdersColumns: NursingOrdersTableColumn[] = ['order', 'orderAdded', 'status'];

type NursingOrdersInlineView = { name: 'list' } | { name: 'create' } | { name: 'details'; serviceRequestId: string };

// The nursing orders screens are a list plus create/details sub-screens reached by
// navigation, so like the radiology section this edit content is a small local view
// switcher over the same reused components — the whole flow stays on Review & Sign.
export const NursingOrdersInlineFlow: FC = () => {
  const [view, setView] = useState<NursingOrdersInlineView>({ name: 'list' });
  const { id: appointmentId } = useParams();
  const { encounter } = useAppointmentData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  // The list refetches on mount, so returning to it is enough to pick up the change.
  const goToList = useCallback((): void => setView({ name: 'list' }), []);

  if (!appointmentId || !encounter?.id) return null;

  if (view.name === 'create') {
    return <NursingOrderCreatePage onFinished={goToList} />;
  }

  if (view.name === 'details') {
    return <NursingOrderDetailsPage serviceRequestId={view.serviceRequestId} onBack={goToList} />;
  }

  return (
    <Stack spacing={1}>
      {!isReadOnly && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ButtonRounded
            variant="contained"
            color="primary"
            onClick={() => setView({ name: 'create' })}
            sx={{ py: 1, px: 5 }}
            data-testid={dataTestIds.nursingOrdersPage.orderButton}
          >
            Order
          </ButtonRounded>
        </Box>
      )}
      <NursingOrdersTable
        columns={nursingOrdersColumns}
        searchBy={{ field: 'encounterId', value: encounter.id }}
        appointmentId={appointmentId}
        allowDelete={!isReadOnly}
        onRowClick={(order) => setView({ name: 'details', serviceRequestId: order.serviceRequestId })}
      />
    </Stack>
  );
};
