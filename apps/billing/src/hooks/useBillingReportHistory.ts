import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshReportKind } from 'utils/lib/types/data/billing/billing.constants';
import { BillingReportHistoryEntry } from 'utils/lib/types/data/billing/billing.types';
import { getBillingReportHistory } from '../api/api';
import { useApiClients } from './useAppClients';

// The cached runs of one report kind, newest first. `entries` stays undefined until the first
// load resolves so pages can adopt the latest run's params before fetching a report.
export function useBillingReportHistory(kind: RefreshReportKind): {
  entries: BillingReportHistoryEntry[] | undefined;
  reload: () => void;
} {
  const { oystehrZambda } = useApiClients();
  const [entries, setEntries] = useState<BillingReportHistoryEntry[] | undefined>(undefined);
  // drops responses of superseded loads
  const generation = useRef(0);

  const reload = useCallback((): void => {
    if (!oystehrZambda) return;
    const myGeneration = ++generation.current;
    getBillingReportHistory(oystehrZambda, kind)
      .then((response) => {
        if (generation.current === myGeneration) setEntries(response.entries);
      })
      .catch((err) => {
        console.error(`Failed to load ${kind} report history:`, err);
        // an unreachable history should not block the page: fall back to the empty-report state
        if (generation.current === myGeneration) setEntries((current) => current ?? []);
      });
  }, [oystehrZambda, kind]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { entries, reload };
}
