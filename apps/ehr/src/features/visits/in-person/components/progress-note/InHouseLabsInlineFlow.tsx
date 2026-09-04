import { Box, Stack } from '@mui/material';
import { FC, useCallback, useState } from 'react';
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
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useRefreshNoteSummaries } from './useRefreshNoteSummaries';

const inHouseLabsColumns: InHouseLabsTableColumn[] = ['testType', 'orderAdded', 'provider', 'dx', 'status', 'actions'];

type InHouseLabsInlineView =
  | { name: 'list' }
  | { name: 'create'; prefill?: InHouseLabOrderPrefill }
  | { name: 'details'; serviceRequestId: string };

export const InHouseLabsInlineFlow: FC = () => {
  const [view, setView] = useState<InHouseLabsInlineView>({ name: 'list' });
  const { encounter } = useAppointmentData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const encounterId = encounter?.id;
  const refreshSummaries = useRefreshNoteSummaries({ fields: ['inHouseLabResults'] });

  const goToList = useCallback((): void => {
    setView({ name: 'list' });
    refreshSummaries();
  }, [refreshSummaries]);

  const handleCreateFinished = useCallback(
    (serviceRequestId?: string): void => {
      if (serviceRequestId) {
        // exactly one test was created — open its details view (mirrors the page flow,
        // which navigates forward to the new order's details)
        setView({ name: 'details', serviceRequestId });
        refreshSummaries();
      } else {
        goToList();
      }
    },
    [goToList, refreshSummaries]
  );

  if (view.name === 'create') {
    return <InHouseLabOrderCreatePage prefill={view.prefill} onFinished={handleCreateFinished} onBack={goToList} />;
  }

  if (view.name === 'details') {
    return (
      <InHouseLabTestDetailsPage
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
