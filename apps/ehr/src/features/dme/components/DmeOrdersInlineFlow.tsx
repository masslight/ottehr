import { Box, Stack } from '@mui/material';
import { FC, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useRefreshNoteSummaries } from 'src/features/visits/in-person/components/progress-note/useRefreshNoteSummaries';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { DME_ORDERS_QUERY_KEY } from '../dme.queries';
import { DmeOrderCreatePage } from '../pages/DmeOrderCreatePage';
import { DmeOrderDetailsPage } from '../pages/DmeOrderDetailsPage';
import { DmeOrderEditPage } from '../pages/DmeOrderEditPage';
import { DmeOrdersTable } from './DmeOrdersTable';

type DmeOrdersInlineView =
  | { name: 'list' }
  | { name: 'create' }
  | { name: 'details'; deviceRequestId: string }
  | { name: 'edit'; deviceRequestId: string };

export const DmeOrdersInlineFlow: FC = () => {
  const [view, setView] = useState<DmeOrdersInlineView>({ name: 'list' });
  const { id: appointmentId } = useParams();
  const { encounter } = useAppointmentData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  // In-house orders add billing codes, so the Assessment summary needs a re-read too.
  const refreshSummaries = useRefreshNoteSummaries({ extraQueryKeys: [[DME_ORDERS_QUERY_KEY]] });

  const goToList = useCallback((): void => {
    setView({ name: 'list' });
    refreshSummaries();
  }, [refreshSummaries]);

  if (!appointmentId || !encounter?.id) return null;

  if (view.name === 'create') {
    return <DmeOrderCreatePage onFinished={goToList} onCancel={() => setView({ name: 'list' })} />;
  }

  if (view.name === 'details') {
    return (
      <DmeOrderDetailsPage
        deviceRequestId={view.deviceRequestId}
        onBack={goToList}
        onEdit={(order) => setView({ name: 'edit', deviceRequestId: order.id })}
      />
    );
  }

  if (view.name === 'edit') {
    const backToDetails = (): void => setView({ name: 'details', deviceRequestId: view.deviceRequestId });
    return (
      <DmeOrderEditPage deviceRequestId={view.deviceRequestId} onFinished={backToDetails} onCancel={backToDetails} />
    );
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
            data-testid={dataTestIds.dmeOrders.newOrderButton}
          >
            Order
          </ButtonRounded>
        </Box>
      )}
      <DmeOrdersTable
        encounterId={encounter.id}
        appointmentId={appointmentId}
        allowDelete={!isReadOnly}
        onCreateOrder={!isReadOnly ? () => setView({ name: 'create' }) : undefined}
        onRowClick={(order) => setView({ name: 'details', deviceRequestId: order.id })}
      />
    </Stack>
  );
};
