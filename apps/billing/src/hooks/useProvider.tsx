import { useCallback, useEffect, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BillingProviderOption } from 'utils/lib/types/data/billing/billing.types';
import { getBillingProvider } from '../api/api';
import { ProviderRole } from '../constants/provider';
import { useApiClients } from './useAppClients';

export function useProvider({
  type,
  id,
  onLoading,
  onError,
}: {
  type: ProviderRole;
  id: string;
  onLoading?: (loading: boolean) => void;
  onError?: (err: string | null) => void;
}): [BillingProviderOption | null, () => Promise<void>] {
  const { oystehrZambda } = useApiClients();
  const [provider, setProvider] = useState<BillingProviderOption | null>(null);
  const fetchDetail = useCallback(async () => {
    if (!oystehrZambda || !id) return;
    onLoading?.(true);
    onError?.(null);
    try {
      const data = await getBillingProvider(oystehrZambda, {
        providerType: type,
        providerId: id,
      });
      setProvider(data);
    } catch (err) {
      onError?.(getApiError({ error: err, defaultError: 'Failed to load provider' }));
    } finally {
      onLoading?.(false);
    }
  }, [oystehrZambda, type, id, onLoading, onError]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  return [provider, fetchDetail];
}
