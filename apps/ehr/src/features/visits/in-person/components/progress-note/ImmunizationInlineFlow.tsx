import { useQueryClient } from '@tanstack/react-query';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { Immunization, ImmunizationTab } from 'src/features/immunization/pages/Immunization';
import { ImmunizationOrderCreateEdit } from 'src/features/immunization/pages/ImmunizationOrderCreateEdit';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';

type ImmunizationInlineView = { name: 'mar' } | { name: 'order-create' } | { name: 'order-edit'; orderId: string };

// The immunization screens are the MAR page (with its MAR/details tabs) plus an order
// create/edit sub-screen reached by navigation, so unlike the intake sections this edit
// content is a small local view switcher over the same reused components — the whole flow
// stays on Review & Sign.
export const ImmunizationInlineFlow: FC = () => {
  const [view, setView] = useState<ImmunizationInlineView>({ name: 'mar' });
  const [tab, setTab] = useState<ImmunizationTab>('mar');
  const queryClient = useQueryClient();
  const { refetch } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  // Ordering and reads go through the immunization API directly (not save-chart-data), so
  // the Review & Sign summary doesn't refresh on its own. Refetch the chart fields and
  // invalidate the immunization orders query (the key useGetImmunizationOrders uses, which
  // the Review & Sign immunization summary reads) whenever the flow returns to the MAR and
  // again when the section collapses.
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const refreshSummaries = useCallback((): void => {
    void refetchRef.current();
    void queryClient.invalidateQueries({ queryKey: ['get-immunization-orders'], exact: false });
  }, [queryClient]);
  const refreshSummariesRef = useRef(refreshSummaries);
  refreshSummariesRef.current = refreshSummaries;
  useEffect(() => {
    return () => {
      refreshSummariesRef.current();
    };
  }, []);

  const goToMar = useCallback((): void => {
    setView({ name: 'mar' });
    setTab('mar');
    refreshSummariesRef.current();
  }, []);

  // Administering/deleting from the details tab lands back on the MAR tab through here, so
  // refresh on that transition too.
  const handleTabChange = useCallback((nextTab: ImmunizationTab): void => {
    setTab(nextTab);
    if (nextTab === 'mar') {
      refreshSummariesRef.current();
    }
  }, []);

  if (view.name === 'order-create') {
    return <ImmunizationOrderCreateEdit variant="inline" onFinished={goToMar} />;
  }

  if (view.name === 'order-edit') {
    return <ImmunizationOrderCreateEdit variant="inline" orderId={view.orderId} onFinished={goToMar} />;
  }

  return (
    <Immunization
      variant="inline"
      tab={tab}
      onTabChange={handleTabChange}
      onCreateOrder={!isReadOnly ? () => setView({ name: 'order-create' }) : undefined}
      onEditOrder={!isReadOnly ? (orderId) => setView({ name: 'order-edit', orderId }) : undefined}
    />
  );
};
