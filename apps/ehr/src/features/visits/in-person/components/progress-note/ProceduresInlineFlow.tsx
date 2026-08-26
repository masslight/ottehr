import { FC, useCallback, useState } from 'react';
import { ProceduresBody } from 'src/features/visits/in-person/pages/Procedures';
import ProceduresNew from 'src/features/visits/in-person/pages/ProceduresNew';
import { useRefreshNoteSummaries } from './useRefreshNoteSummaries';

type ProceduresInlineView = { name: 'list' } | { name: 'new' } | { name: 'edit'; procedureId: string };

export const ProceduresInlineFlow: FC = () => {
  const [view, setView] = useState<ProceduresInlineView>({ name: 'list' });
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
