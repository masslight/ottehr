import { useCallback, useEffect, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BillingCoverageOption } from 'utils/lib/types/data/billing/billing.types';
import { getBillingCoverage } from '../api/api';
import { useApiClients } from './useAppClients';

export function useCoverage({
  id,
  onLoading,
  onError,
}: {
  id?: string;
  onLoading?: (loading: boolean) => void;
  onError?: (err: string | null) => void;
}): [BillingCoverageOption | null, () => Promise<void>] {
  const { oystehrZambda } = useApiClients();
  const [coverage, setCoverage] = useState<BillingCoverageOption | null>(null);
  const fetchCoverage = useCallback(async () => {
    if (!oystehrZambda || !id) return;
    onLoading?.(true);
    onError?.(null);
    try {
      const data = await getBillingCoverage(oystehrZambda, {
        coverageId: id,
      });
      setCoverage(data);
    } catch (err) {
      onError?.(getApiError({ error: err, defaultError: 'Failed to load provider' }));
    } finally {
      onLoading?.(false);
    }
  }, [oystehrZambda, id, onLoading, onError]);

  useEffect(() => {
    void fetchCoverage();
  }, [fetchCoverage]);

  return [coverage, fetchCoverage];
}
