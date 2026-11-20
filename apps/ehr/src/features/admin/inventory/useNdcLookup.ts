import { useEffect, useState } from 'react';
import { lookupNdc } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { LookupNdcResponse } from 'utils/lib/types/api/config/in-house-medications';

export type NdcLookupState = { status: 'idle' | 'loading' } | LookupNdcResponse;

const NDC_LOOKUP_DEBOUNCE_MS = 600;

/**
 * What the NDC directory (or, for a vaccine, the CDC crosswalk) says the typed box NDC is, compared with the
 * medication: looked up once typing pauses, and a result for an NDC that has since changed is dropped. An empty
 * NDC or no medication is idle; a failed lookup is 'unavailable'.
 */
export const useNdcLookup = (ndc: string, medicationId: string | undefined): NdcLookupState => {
  const { oystehrZambda } = useApiClients();
  const [lookup, setLookup] = useState<NdcLookupState>({ status: 'idle' });
  const trimmed = ndc.trim();
  useEffect(() => {
    if (!oystehrZambda || !trimmed || !medicationId) {
      setLookup({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setLookup({ status: 'loading' });
    const timer = setTimeout(() => {
      lookupNdc(oystehrZambda, { ndc: trimmed, medicationId })
        .then((result) => {
          if (!cancelled) setLookup(result);
        })
        .catch((error) => {
          console.error('Error looking up NDC', error);
          if (!cancelled) setLookup({ status: 'unavailable' });
        });
    }, NDC_LOOKUP_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, oystehrZambda, medicationId]);
  return lookup;
};
