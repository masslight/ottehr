import { Box, Stack } from '@mui/material';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { LabsTablePatientChart } from 'src/features/external-labs/components/labs-orders/LabsTablePatientChart';
import { CreateExternalLabOrder } from 'src/features/external-labs/pages/CreateExternalLabOrder';
import { externalLabsColumns } from 'src/features/external-labs/pages/ExternalLabOrdersListPage';
import { OrderDetailsPage } from 'src/features/external-labs/pages/OrderDetails';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { LabOrderListPageDTO } from 'utils/lib/types/data/labs/labs.types';

type ExternalLabsInlineView = { name: 'list' } | { name: 'create' } | { name: 'details'; serviceRequestId: string };

// default is 10, but to handle edge cases, we're upping the number. realistically most encounters won't have more than 10 anyway
const ITEMS_PER_PAGE = 100;

// The external labs screens are an orders list plus create/details sub-screens reached by
// navigation, so unlike the intake sections this edit content is a small local view
// switcher over the same reused components — the whole flow stays on Review & Sign.
// Diagnostic-report centric results (reflex/pdf attachment) still navigate to their own
// page since that screen is keyed by diagnosticReportId rather than serviceRequestId.
export const ExternalLabsInlineFlow: FC = () => {
  const [view, setView] = useState<ExternalLabsInlineView>({ name: 'list' });
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const { refetch } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

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

  const openOrder = useCallback((labOrderData: LabOrderListPageDTO): void => {
    setView({ name: 'details', serviceRequestId: labOrderData.serviceRequestId });
  }, []);

  if (view.name === 'create') {
    return <CreateExternalLabOrder variant="inline" onFinished={goToList} />;
  }

  if (view.name === 'details') {
    return <OrderDetailsPage variant="inline" serviceRequestId={view.serviceRequestId} onBack={goToList} />;
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
            data-testid={dataTestIds.externalLabs.labsTable.addExternalLabBtn}
            variant="contained"
            color="primary"
            size={'medium'}
            onClick={() => setView({ name: 'create' })}
            sx={{
              py: 1,
              px: 5,
              textWrap: 'nowrap',
            }}
          >
            + External Lab
          </ButtonRounded>
        </Box>
      )}
      <LabsTablePatientChart
        searchBy={{ searchBy: { field: 'encounterId', value: encounterId }, itemsPerPage: ITEMS_PER_PAGE }}
        columns={externalLabsColumns}
        allowDelete={!isReadOnly}
        allowSubmit={!isReadOnly}
        onCreateOrder={!isReadOnly ? () => setView({ name: 'create' }) : undefined}
        onRowClick={openOrder}
      />
    </Stack>
  );
};
