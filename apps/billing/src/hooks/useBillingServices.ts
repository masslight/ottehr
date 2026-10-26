import { useCallback, useEffect, useRef, useState } from 'react';
import { formatAntCaseString } from 'utils/lib/types/data/billing/claim-status';
import { searchBillingServices } from '../api/api';
import { useApiClients } from './useAppClients';

// The services on claims created from visits so far (the list search-billing-services reads), each as
// the code a claim's service tag carries and the name the claim screens show for it. Shared by the
// claims list's Service filter, which filters claims by code, and the rules builder's ServiceSelect,
// which offers them by name. The list is small, so it loads whole and callers filter it client-side by
// name — its server-side search only matches an exact code. Pickers call `load` when opened, which
// retries a load that failed.

export interface BillingServiceOption {
  code: string;
  name: string;
}

export const billingServiceOption = (code: string): BillingServiceOption => ({
  code,
  name: formatAntCaseString(code),
});

export function useBillingServices(): { services: BillingServiceOption[]; load: () => void } {
  const { oystehrZambda } = useApiClients();
  const [services, setServices] = useState<BillingServiceOption[]>([]);
  // Set while a load is under way or once one succeeded; cleared when one fails, so `load` retries.
  const requested = useRef(false);

  const load = useCallback((): void => {
    if (requested.current || !oystehrZambda) return;
    requested.current = true;
    searchBillingServices(oystehrZambda, {})
      // The list's `name` is the service code.
      .then((res) => setServices((res.services ?? []).filter((s) => s.name).map((s) => billingServiceOption(s.name))))
      .catch((err) => {
        requested.current = false;
        console.error('Failed to load services:', err);
      });
  }, [oystehrZambda]);

  useEffect(() => load(), [load]);

  return { services, load };
}
