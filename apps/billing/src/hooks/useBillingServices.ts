import { useCallback, useEffect, useRef, useState } from 'react';
import { BillingService } from 'utils/lib/types/data/billing/billing.types';
import { searchBillingServices } from '../api/api';
import { useApiClients } from './useAppClients';

// The services on claims created from visits so far (search-billing-services; each one's `name` is
// its service code). Shared by the claims list's Service filter and the rules builder's ServiceSelect,
// which both show a service by its displayed name and work with its code. The list is small, so it
// loads whole and callers filter it client-side by name. Pickers call `load` when opened, which retries
// a load that failed.
export function useBillingServices(): { services: BillingService[]; load: () => void } {
  const { oystehrZambda } = useApiClients();
  const [services, setServices] = useState<BillingService[]>([]);
  // Set while a load is under way or once one succeeded; cleared when one fails, so `load` retries.
  const requested = useRef(false);

  const load = useCallback((): void => {
    if (requested.current || !oystehrZambda) return;
    requested.current = true;
    searchBillingServices(oystehrZambda, {})
      .then((res) => setServices(res.services ?? []))
      .catch((err) => {
        requested.current = false;
        console.error('Failed to load services:', err);
      });
  }, [oystehrZambda]);

  useEffect(() => load(), [load]);

  return { services, load };
}
