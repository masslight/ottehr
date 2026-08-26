import { Box, Stack } from '@mui/material';
import { FC, useCallback, useState } from 'react';
import { RadiologyOrderCreateButton } from 'src/features/radiology/components/RadiologyOrderCreateButton';
import { RadiologyTable } from 'src/features/radiology/components/RadiologyTable';
import { CreateExternalRadiologyOrder } from 'src/features/radiology/pages/CreateExternalRadiologyOrder';
import { CreateRadiologyOrder } from 'src/features/radiology/pages/CreateRadiologyOrder';
import { RadiologyExternalOrderDetailsPage } from 'src/features/radiology/pages/RadiologyExternalOrderDetails';
import { RadiologyOrderDetailsPage } from 'src/features/radiology/pages/RadiologyOrderDetails';
import { radiologyOrderListColumns } from 'src/features/radiology/pages/RadiologyOrdersListPage';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { GetRadiologyOrderListZambdaOrder } from 'utils/lib/types/api/radiology';
import { useRefreshNoteSummaries } from './useRefreshNoteSummaries';

type RadiologyInlineView =
  | { name: 'list' }
  | { name: 'create' }
  | { name: 'create-external' }
  | { name: 'details'; serviceRequestId: string }
  | { name: 'external-details'; serviceRequestId: string }
  | { name: 'external-edit'; order: GetRadiologyOrderListZambdaOrder };

export const RadiologyInlineFlow: FC = () => {
  const [view, setView] = useState<RadiologyInlineView>({ name: 'list' });
  const { encounter } = useAppointmentData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  // Ordering and reads go through the radiology API directly, so refresh the note summaries
  // whenever the flow returns to the list and again when the section collapses.
  const refreshSummaries = useRefreshNoteSummaries();

  const goToList = useCallback((): void => {
    setView({ name: 'list' });
    refreshSummaries();
  }, [refreshSummaries]);

  const openOrder = useCallback((order: GetRadiologyOrderListZambdaOrder): void => {
    setView(
      order.external
        ? { name: 'external-details', serviceRequestId: order.serviceRequestId }
        : { name: 'details', serviceRequestId: order.serviceRequestId }
    );
  }, []);

  if (view.name === 'create') {
    return <CreateRadiologyOrder onFinished={goToList} />;
  }

  if (view.name === 'create-external') {
    return <CreateExternalRadiologyOrder onFinished={goToList} />;
  }

  if (view.name === 'details') {
    return <RadiologyOrderDetailsPage serviceRequestId={view.serviceRequestId} onBack={goToList} />;
  }

  if (view.name === 'external-details') {
    return (
      <RadiologyExternalOrderDetailsPage
        serviceRequestId={view.serviceRequestId}
        onBack={goToList}
        onEdit={(order) => setView({ name: 'external-edit', order })}
      />
    );
  }

  if (view.name === 'external-edit') {
    return (
      <CreateExternalRadiologyOrder
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
