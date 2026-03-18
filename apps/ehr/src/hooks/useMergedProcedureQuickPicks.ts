import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProcedureQuickPicks } from 'src/api/api';
import { ProcedureQuickPickData, PROCEDURES_CONFIG } from 'utils';
import { useApiClients } from './useAppClients';

/**
 * Merges hardcoded procedure quick picks (from PROCEDURES_CONFIG) with
 * FHIR-based quick picks fetched from the admin-get-procedure-quick-picks zambda.
 *
 * Hardcoded quick picks appear first, followed by FHIR quick picks.
 * If the zambda is not deployed or fails, only hardcoded quick picks are returned.
 */
export function useMergedProcedureQuickPicks(): {
  quickPicks: ProcedureQuickPickData[];
  loading: boolean;
} {
  const { oystehrZambda } = useApiClients();
  const [fhirQuickPicks, setFhirQuickPicks] = useState<ProcedureQuickPickData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFhirQuickPicks = useCallback(async () => {
    if (!oystehrZambda) {
      setLoading(false);
      return;
    }
    try {
      const response = await getProcedureQuickPicks(oystehrZambda);
      setFhirQuickPicks(response.quickPicks);
    } catch (error) {
      // Zambda may not be deployed — fall back to hardcoded only
      console.log('FHIR procedure quick picks not available, using hardcoded only:', error);
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda]);

  useEffect(() => {
    void fetchFhirQuickPicks();
  }, [fetchFhirQuickPicks]);

  // Memoize to provide a stable reference and prevent infinite re-render loops
  // in consumers that use this array in useMemo/useEffect dependency arrays.
  const quickPicks = useMemo(() => {
    const hardcoded: ProcedureQuickPickData[] = PROCEDURES_CONFIG.quickPicks ?? [];
    return [...hardcoded, ...fhirQuickPicks];
  }, [fhirQuickPicks]);

  return { quickPicks, loading };
}
