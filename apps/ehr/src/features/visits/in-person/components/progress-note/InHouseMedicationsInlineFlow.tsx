import { FC, useCallback, useState } from 'react';
import { InHouseMedication, InHouseMedicationTab } from '../../pages/InHouseMedication';
import { InHouseOrderEdit } from '../../pages/InHouseOrderEdit';
import { InHouseOrderNew } from '../../pages/InHouseOrderNew';
import { useRefreshNoteSummaries } from './useRefreshNoteSummaries';

type InHouseMedicationsInlineView = { name: 'mar' } | { name: 'order-new' } | { name: 'order-edit'; orderId: string };

// The in-house medications screens are the MAR (with its MAR / Medication Details tabs) plus
// order create/edit sub-screens reached by navigation, so like the radiology section this edit
// content is a small local view switcher over the same reused components — the whole flow stays
// on Review & Sign. The MAR tab is driven by local state instead of the URL.
export const InHouseMedicationsInlineFlow: FC = () => {
  const [view, setView] = useState<InHouseMedicationsInlineView>({ name: 'mar' });
  const [tab, setTab] = useState<InHouseMedicationTab>('mar');
  // Medication orders go through the create-update-medication-order API, so refresh the note
  // summaries whenever the flow returns to the MAR and again when the section collapses.
  const refreshSummaries = useRefreshNoteSummaries();

  const goToMar = useCallback((): void => {
    setView({ name: 'mar' });
    setTab('mar');
    refreshSummaries();
  }, [refreshSummaries]);

  if (view.name === 'order-new') {
    return <InHouseOrderNew onFinished={goToMar} />;
  }

  if (view.name === 'order-edit') {
    return (
      <InHouseOrderEdit orderId={view.orderId} onBack={goToMar} onOrderNew={() => setView({ name: 'order-new' })} />
    );
  }

  return (
    <InHouseMedication
      tab={tab}
      onTabChange={setTab}
      onOrderNew={() => setView({ name: 'order-new' })}
      onEditOrder={(orderId) => setView({ name: 'order-edit', orderId })}
    />
  );
};
