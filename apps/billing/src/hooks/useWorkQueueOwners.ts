import { useEffect, useState } from 'react';
import { WorkQueueOwner } from 'utils/lib/types/data/billing/work-queue.schemas';
import { searchBillingWorkQueueOwners } from '../api/api';
import { useApiClients } from './useAppClients';

// The users a work queue can be assigned to (everyone with the Billing Admin role).
export function useWorkQueueOwners(enabled = true): { owners: WorkQueueOwner[]; loading: boolean } {
  const { oystehrZambda } = useApiClients();
  const [owners, setOwners] = useState<WorkQueueOwner[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!oystehrZambda || !enabled) return;
    let cancelled = false;
    setLoading(true);
    searchBillingWorkQueueOwners(oystehrZambda)
      .then((res) => {
        if (!cancelled) setOwners(res.owners ?? []);
      })
      .catch((err) => {
        console.error('Failed to load work queue owners:', err);
        if (!cancelled) setOwners([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [oystehrZambda, enabled]);

  return { owners, loading };
}
