import { useCallback, useState } from 'react';
import { BillingProviderOption, ServiceFacilityItem } from 'utils';
import { searchBillingProviders, searchBillingServiceFacilities } from '../api/api';
import { useApiClients } from './useAppClients';
import { useDebounce } from './useDebounce';

// The one debounced search-by-name behind every provider/facility dropdown — the claim view's
// replace pickers, the create-claim form, and the rules builder's reference selects — so they all
// query the same lists the provider/facility management pages show.

export function useProviderOptionsSearch(providerType: 'rendering' | 'billing'): {
  options: BillingProviderOption[];
  search: (query?: string) => void;
} {
  const { oystehrZambda } = useApiClients();
  const { debounce } = useDebounce(300);
  const [options, setOptions] = useState<BillingProviderOption[]>([]);

  const search = useCallback(
    (query?: string): void =>
      debounce(() => {
        if (!oystehrZambda) return;
        searchBillingProviders(oystehrZambda, { providerType, ...(query ? { name: query } : {}) })
          .then((res) => setOptions(res.providers ?? []))
          .catch(() => setOptions([]));
      }),
    [debounce, oystehrZambda, providerType]
  );

  return { options, search };
}

export function useFacilityOptionsSearch(): {
  options: ServiceFacilityItem[];
  search: (query?: string) => void;
} {
  const { oystehrZambda } = useApiClients();
  const { debounce } = useDebounce(300);
  const [options, setOptions] = useState<ServiceFacilityItem[]>([]);

  const search = useCallback(
    (query?: string): void =>
      debounce(() => {
        if (!oystehrZambda) return;
        searchBillingServiceFacilities(oystehrZambda, query ? { name: query } : {})
          .then((res) => setOptions(res.facilities ?? []))
          .catch(() => setOptions([]));
      }),
    [debounce, oystehrZambda]
  );

  return { options, search };
}
