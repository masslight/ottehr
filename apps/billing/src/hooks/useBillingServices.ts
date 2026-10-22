import { useEffect, useState } from 'react';
import { formatAntCaseString } from 'utils/lib/types/data/billing/claim-status';
import { searchBillingServices } from '../api/api';
import { useApiClients } from './useAppClients';

// The services seen on claims so far (the registry search-billing-services reads), each as the code a
// claim's service tag carries and the name the claim screens show for it. Shared by the claims list's
// Service filter, which filters claims by code, and the rules builder's ServiceSelect, which works in
// names. The registry is small, so it loads whole and callers filter it client-side by name — its
// server-side search only matches an exact code.

export interface BillingServiceOption {
  code: string;
  name: string;
}

export const billingServiceOption = (code: string): BillingServiceOption => ({
  code,
  name: formatAntCaseString(code),
});

export function useBillingServices(): BillingServiceOption[] {
  const { oystehrZambda } = useApiClients();
  const [services, setServices] = useState<BillingServiceOption[]>([]);

  useEffect(() => {
    if (!oystehrZambda) return;
    let active = true;
    searchBillingServices(oystehrZambda, {})
      .then((res) => {
        // The registry's `name` is the service code.
        if (active) setServices((res.services ?? []).filter((s) => s.name).map((s) => billingServiceOption(s.name)));
      })
      .catch((err) => console.error('Failed to load services:', err));
    return () => {
      active = false;
    };
  }, [oystehrZambda]);

  return services;
}
