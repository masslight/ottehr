import { FC, useCallback, useState } from 'react';
import { Immunization, ImmunizationTab } from 'src/features/immunization/pages/Immunization';
import { ImmunizationOrderCreateEdit } from 'src/features/immunization/pages/ImmunizationOrderCreateEdit';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useRefreshNoteSummaries } from './useRefreshNoteSummaries';

type ImmunizationInlineView = { name: 'mar' } | { name: 'order-create' } | { name: 'order-edit'; orderId: string };

// The immunization screens are the MAR page (with its MAR/details tabs) plus an order
// create/edit sub-screen reached by navigation, so unlike the intake sections this edit
// content is a small local view switcher over the same reused components — the whole flow
// stays on Review & Sign.
export const ImmunizationInlineFlow: FC = () => {
  const [view, setView] = useState<ImmunizationInlineView>({ name: 'mar' });
  const [tab, setTab] = useState<ImmunizationTab>('mar');
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  // Ordering and reads go through the immunization API directly, so refresh the note
  // summaries — including the immunization orders query the Review & Sign immunization
  // summary reads — whenever the flow returns to the MAR and again when the section
  // collapses.
  const refreshSummaries = useRefreshNoteSummaries({ extraQueryKeys: [['get-immunization-orders']] });

  const goToMar = useCallback((): void => {
    setView({ name: 'mar' });
    setTab('mar');
    refreshSummaries();
  }, [refreshSummaries]);

  // Administering/deleting from the details tab lands back on the MAR tab through here, so
  // refresh on that transition too.
  const handleTabChange = useCallback(
    (nextTab: ImmunizationTab): void => {
      setTab(nextTab);
      if (nextTab === 'mar') {
        refreshSummaries();
      }
    },
    [refreshSummaries]
  );

  if (view.name === 'order-create') {
    return <ImmunizationOrderCreateEdit onFinished={goToMar} />;
  }

  if (view.name === 'order-edit') {
    return <ImmunizationOrderCreateEdit orderId={view.orderId} onFinished={goToMar} />;
  }

  return (
    <Immunization
      tab={tab}
      onTabChange={handleTabChange}
      onCreateOrder={!isReadOnly ? () => setView({ name: 'order-create' }) : undefined}
      onEditOrder={!isReadOnly ? (orderId) => setView({ name: 'order-edit', orderId }) : undefined}
    />
  );
};
