import { Box, Stack } from '@mui/material';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { RadiologyOrderCreateButton } from 'src/features/radiology/components/RadiologyOrderCreateButton';
import { RadiologyTable } from 'src/features/radiology/components/RadiologyTable';
import { CreateExternalRadiologyOrder } from 'src/features/radiology/pages/CreateExternalRadiologyOrder';
import { CreateRadiologyOrder } from 'src/features/radiology/pages/CreateRadiologyOrder';
import { RadiologyExternalOrderDetailsPage } from 'src/features/radiology/pages/RadiologyExternalOrderDetails';
import { RadiologyOrderDetailsPage } from 'src/features/radiology/pages/RadiologyOrderDetails';
import { radiologyOrderListColumns } from 'src/features/radiology/pages/RadiologyOrdersListPage';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { GetRadiologyOrderListZambdaOrder } from 'utils/lib/types/api/radiology';

type RadiologyInlineView =
  | { name: 'list' }
  | { name: 'create' }
  | { name: 'create-external' }
  | { name: 'details'; serviceRequestId: string }
  | { name: 'external-details'; serviceRequestId: string }
  | { name: 'external-edit'; order: GetRadiologyOrderListZambdaOrder };

// The radiology screens are an orders list plus create/details sub-screens reached by
// navigation, so unlike the intake sections this edit content is a small local view
// switcher over the same reused components — the whole flow stays on Review & Sign.
export const RadiologyInlineFlow: FC = () => {
  const [view, setView] = useState<RadiologyInlineView>({ name: 'list' });
  const { encounter } = useAppointmentData();
  const { refetch } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  // Ordering and reads go through the radiology API directly (not save-chart-data), so
  // the Review & Sign summary's chart-fields query doesn't refresh on its own. Refetch
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

  const openOrder = useCallback((order: GetRadiologyOrderListZambdaOrder): void => {
    setView(
      order.external
        ? { name: 'external-details', serviceRequestId: order.serviceRequestId }
        : { name: 'details', serviceRequestId: order.serviceRequestId }
    );
  }, []);

  if (view.name === 'create') {
    return <CreateRadiologyOrder variant="inline" onFinished={goToList} />;
  }

  if (view.name === 'create-external') {
    return <CreateExternalRadiologyOrder variant="inline" onFinished={goToList} />;
  }

  if (view.name === 'details') {
    return <RadiologyOrderDetailsPage variant="inline" serviceRequestId={view.serviceRequestId} onBack={goToList} />;
  }

  if (view.name === 'external-details') {
    return (
      <RadiologyExternalOrderDetailsPage
        variant="inline"
        serviceRequestId={view.serviceRequestId}
        onBack={goToList}
        onEdit={(order) => setView({ name: 'external-edit', order })}
      />
    );
  }

  if (view.name === 'external-edit') {
    return (
      <CreateExternalRadiologyOrder
        variant="inline"
        initialOrder={view.order}
        onFinished={() => setView({ name: 'external-details', serviceRequestId: view.order.serviceRequestId })}
      />
    );
  }

  return (
    <Stack spacing={1}>
      {!isReadOnly && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <RadiologyOrderCreateButton
            onCreateOrder={() => setView({ name: 'create' })}
            onCreateExternalOrder={() => setView({ name: 'create-external' })}
          />
        </Box>
      )}
      <RadiologyTable
        encounterId={encounter?.id}
        columns={radiologyOrderListColumns}
        showFilters={false}
        allowDelete={!isReadOnly}
        onCreateOrder={!isReadOnly ? () => setView({ name: 'create' }) : undefined}
        onRowClick={openOrder}
      />
    </Stack>
  );
};
