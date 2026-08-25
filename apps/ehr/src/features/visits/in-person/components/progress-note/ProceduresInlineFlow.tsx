import { FC, useCallback, useState } from 'react';
import { ProceduresBody } from 'src/features/visits/in-person/pages/Procedures';
import ProceduresNew from 'src/features/visits/in-person/pages/ProceduresNew';
import { useRefreshNoteSummaries } from './useRefreshNoteSummaries';

type ProceduresInlineView = { name: 'list' } | { name: 'new' } | { name: 'edit'; procedureId: string };

// The procedures screens are a list plus a create/edit form reached by navigation, so like
// the radiology section this edit content is a small local view switcher over the same
// reused components — the whole flow stays on Review & Sign.
export const ProceduresInlineFlow: FC = () => {
  const [view, setView] = useState<ProceduresInlineView>({ name: 'list' });
  // Procedure saves already sync chartData.procedures via setPartialChartData, but refresh
  // whenever the flow returns to the list and again when the section collapses so the
  // Review & Sign summary stays consistent with the other inline flows.
  const refreshSummaries = useRefreshNoteSummaries();

  const goToList = useCallback((): void => {
    setView({ name: 'list' });
    refreshSummaries();
  }, [refreshSummaries]);

  const openProcedure = useCallback((procedureId: string | undefined): void => {
    if (!procedureId) return;
    setView({ name: 'edit', procedureId });
  }, []);

  if (view.name === 'new') {
    return <ProceduresNew key="new" onFinished={goToList} />;
  }

  if (view.name === 'edit') {
    return <ProceduresNew key={view.procedureId} procedureId={view.procedureId} onFinished={goToList} />;
  }

  return <ProceduresBody onNewProcedure={() => setView({ name: 'new' })} onProcedureClick={openProcedure} />;
};
