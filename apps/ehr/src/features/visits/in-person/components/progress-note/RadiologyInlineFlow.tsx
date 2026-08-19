import { Box, Stack } from '@mui/material';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { RadiologyOrderCreateButton } from 'src/features/radiology/components/RadiologyOrderCreateButton';
import { RadiologyTable } from 'src/features/radiology/components/RadiologyTable';
import { CreateExternalRadiologyOrder } from 'src/features/radiology/pages/CreateExternalRadiologyOrder';
import { CreateRadiologyOrder } from 'src/features/radiology/pages/CreateRadiologyOrder';
import { radiologyOrderListColumns } from 'src/features/radiology/pages/RadiologyOrdersListPage';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';

type RadiologyInlineView = 'list' | 'create' | 'create-external';

// The radiology screens are an orders list plus create sub-screens reached by navigation,
// so unlike the intake sections this edit content is a small local view switcher over the
// same reused components. Clicking an existing order row still navigates to the full
// details/read pages — those workflows stay out of the inline prototype.
export const RadiologyInlineFlow: FC = () => {
  const [view, setView] = useState<RadiologyInlineView>('list');
  const { encounter } = useAppointmentData();
  const { refetch } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  // Ordering goes through the radiology API directly (not save-chart-data), so the
  // Review & Sign summary's chart-fields query doesn't refresh on its own. Refetch when
  // an order is placed and again when the section collapses (covers inline deletes).
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useEffect(() => {
    return () => {
      void refetchRef.current();
    };
  }, []);

  const handleFinished = useCallback((): void => {
    setView('list');
    void refetchRef.current();
  }, []);

  if (view === 'create') {
    return <CreateRadiologyOrder variant="inline" onFinished={handleFinished} />;
  }

  if (view === 'create-external') {
    return <CreateExternalRadiologyOrder variant="inline" onFinished={handleFinished} />;
  }

  return (
    <Stack spacing={1}>
      {!isReadOnly && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <RadiologyOrderCreateButton
            onCreateOrder={() => setView('create')}
            onCreateExternalOrder={() => setView('create-external')}
          />
        </Box>
      )}
      <RadiologyTable
        encounterId={encounter?.id}
        columns={radiologyOrderListColumns}
        showFilters={false}
        allowDelete={!isReadOnly}
        onCreateOrder={!isReadOnly ? () => setView('create') : undefined}
      />
    </Stack>
  );
};
