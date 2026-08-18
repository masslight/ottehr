// The practice's procedure quick-picks, plus the code→name map their `procedureType` needs.
//
// Both come from exactly the sources the regular Procedures page uses:
//   - `getProcedureQuickPicks` — the same list its "Quick picks" button shows, so a procedure the
//     assistant can chart is one the provider can already see there.
//   - the procedure-types ValueSet — because that page saves the human-readable NAME
//     ("Laceration Repair"), not the code ("laceration-repair"). Charting the code would make the note
//     disagree with the dropdown for the same procedure.
//
// AWAITED, NOT READ OFF STATE. This returns a `load()` promise rather than the data, because the
// catalogue is consulted the moment a provider sends a dictation — which can be before a hook's state
// has settled. Reading a still-loading list would report zero quick-picks, and zero quick-picks is a
// MEANINGFUL answer here: it tells the provider their practice has none configured and to use the
// Procedures tab. `ensureQueryData` resolves from the session cache when it is warm and fetches once
// when it is not, so the answer is never "not loaded yet" dressed up as "not configured".
//
// The ValueSet is cached for the session: it changes when an admin edits it, not while a provider
// charts. When it cannot be read the code is the fallback — a procedure charted under a kebab-case type
// is recoverable, a procedure not charted at all loses a billable item.

import Oystehr from '@oystehr/sdk';
import { useQueryClient } from '@tanstack/react-query';
import { ValueSet } from 'fhir/r4b';
import { useCallback } from 'react';
import { getProcedureQuickPicks } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { PROCEDURE_TYPES_VALUE_SET_URL } from 'utils/lib/types/api/procedures.constants';
import { ProcedureQuickPickData } from 'utils/lib/types/api/quick-picks.types';

const SESSION = 5 * 60 * 1000;

export interface ProcedureQuickPickCatalogue {
  quickPicks: ProcedureQuickPickData[];
  /** procedureType code → the display name the dropdown shows. Empty when the ValueSet is unreadable. */
  procedureTypeNameByCode: Map<string, string>;
}

/** Resolves both halves of the catalogue, from cache when warm. */
export function useProcedureQuickPicks(): () => Promise<ProcedureQuickPickCatalogue> {
  const queryClient = useQueryClient();
  const { oystehr, oystehrZambda } = useApiClients();

  return useCallback(async () => {
    const [quickPicks, procedureTypeNameByCode] = await Promise.all([
      queryClient.ensureQueryData({
        queryKey: ['easy-chart-procedure-quick-picks'],
        queryFn: async () => {
          if (!oystehrZambda) return [] as ProcedureQuickPickData[];
          const response = await getProcedureQuickPicks(oystehrZambda);
          return response.quickPicks ?? [];
        },
        staleTime: SESSION,
      }),
      queryClient.ensureQueryData({
        queryKey: ['easy-chart-procedure-types'],
        queryFn: () => fetchProcedureTypeNames(oystehr),
        staleTime: SESSION,
      }),
    ]);
    return { quickPicks, procedureTypeNameByCode };
  }, [queryClient, oystehr, oystehrZambda]);
}

async function fetchProcedureTypeNames(oystehr: Oystehr | undefined): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!oystehr) return names;
  const bundle = await oystehr.fhir.search<ValueSet>({
    resourceType: 'ValueSet',
    params: [{ name: 'url', value: PROCEDURE_TYPES_VALUE_SET_URL }],
  });
  // ValueSets are versioned and the search returns every version. The largest expansion is the current
  // one — taking a stale version would silently drop procedure types from the map.
  let best: { code?: string; display?: string }[] = [];
  for (const valueSet of bundle.unbundle()) {
    const contains = valueSet.expansion?.contains ?? [];
    if (contains.length > best.length) best = contains;
  }
  for (const entry of best) {
    if (entry.code && entry.display) names.set(entry.code, entry.display);
  }
  return names;
}
