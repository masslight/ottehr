import { useCallback, useEffect, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { ServiceFacilityItem } from 'utils/lib/types/data/billing/billing.types';
import { getBillingServiceFacility } from '../api/api';
import { useApiClients } from './useAppClients';

export function useServiceFacility({
  id,
  onLoading,
  onError,
}: {
  id: string;
  onLoading?: (loading: boolean) => void;
  onError?: (err: string | null) => void;
}): [ServiceFacilityItem | null, () => Promise<void>] {
  const { oystehrZambda } = useApiClients();
  const [serviceFacility, setServiceFacility] = useState<ServiceFacilityItem | null>(null);
  const fetchDetail = useCallback(async () => {
    if (!oystehrZambda || !id) return;
    onLoading?.(true);
    onError?.(null);
    try {
      const data = await getBillingServiceFacility(oystehrZambda, { facilityId: id });
      setServiceFacility(data);
    } catch (err) {
      onError?.(getApiError({ error: err, defaultError: 'Failed to load service facility' }));
    } finally {
      onLoading?.(false);
    }
  }, [oystehrZambda, id, onLoading, onError]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  return [serviceFacility, fetchDetail];
}
