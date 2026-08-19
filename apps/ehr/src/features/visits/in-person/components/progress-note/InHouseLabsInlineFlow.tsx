import { Box, Stack } from '@mui/material';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  InHouseLabsTable,
  InHouseLabsTableColumn,
} from 'src/features/in-house-labs/components/orders/InHouseLabsTable';
import {
  InHouseLabOrderCreatePage,
  InHouseLabOrderPrefill,
} from 'src/features/in-house-labs/pages/InHouseLabOrderCreatePage';
import { InHouseLabTestDetailsPage } from 'src/features/in-house-labs/pages/InHouseLabOrderDetailsPage';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';

const inHouseLabsColumns: InHouseLabsTableColumn[] = ['testType', 'orderAdded', 'provider', 'dx', 'status', 'actions'];

type InHouseLabsInlineView =
  | { name: 'list' }
  | { name: 'create'; prefill?: InHouseLabOrderPrefill }
  | { name: 'details'; serviceRequestId: string };

// The in-house labs screens are an orders list plus create/details sub-screens reached by
// navigation, so unlike the intake sections this edit content is a small local view
// switcher over the same reused components — the whole flow stays on Review & Sign.
export const InHouseLabsInlineFlow: FC = () => {
  const [view, setView] = useState<InHouseLabsInlineView>({ name: 'list' });
  const { encounter } = useAppointmentData();
  const { refetch } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const encounterId = encounter?.id;

  // Ordering and reads go through the labs API directly (not save-chart-data), so the
  // Review & Sign summary's chart-fields query doesn't refresh on its own. Refetch
  // whenever the flow returns to the list and again when the section collapses.
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useEffect(() => {
    return () => {
      void refetchRef.current();
    };
  }, []);

  const goToList = useCallback((): void => {
    setView({ name: 'list' });
    void refetchRef.current();
  }, []);

  const handleCreateFinished = useCallback(
    (serviceRequestId?: string): void => {
      if (serviceRequestId) {
        // exactly one test was created — open its details view (mirrors the page flow,
        // which navigates forward to the new order's details)
        setView({ name: 'details', serviceRequestId });
        void refetchRef.current();
      } else {
        goToList();
      }
    },
    [goToList]
  );

  if (view.name === 'create') {
    return (
      <InHouseLabOrderCreatePage
        variant="inline"
        prefill={view.prefill}
        onFinished={handleCreateFinished}
        onBack={goToList}
      />
    );
  }

  if (view.name === 'details') {
    return (
      <InHouseLabTestDetailsPage
        variant="inline"
        serviceRequestId={view.serviceRequestId}
        onBack={goToList}
        onOrderTest={(prefill) => setView({ name: 'create', prefill })}
      />
    );
  }

  if (!encounterId) {
    console.error('No encounter ID found');
    return null;
  }

  return (
    <Stack spacing={1}>
      {!isReadOnly && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ButtonRounded
            data-testid={dataTestIds.inHouseLabsPage.orderButton}
            variant="contained"
            color="primary"
            size={'medium'}
            onClick={() => setView({ name: 'create' })}
            sx={{
              py: 1,
              px: 5,
            }}
          >
            Order
          </ButtonRounded>
        </Box>
      )}
      <InHouseLabsTable
        searchBy={{ searchBy: { field: 'encounterId', value: encounterId } }}
        columns={inHouseLabsColumns}
        showFilters={false}
        allowDelete={!isReadOnly}
        onCreateOrder={!isReadOnly ? () => setView({ name: 'create' }) : undefined}
        onRowClick={(order) => setView({ name: 'details', serviceRequestId: order.serviceRequestId })}
      />
    </Stack>
  );
};
