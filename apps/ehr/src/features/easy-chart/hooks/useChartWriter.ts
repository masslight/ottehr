// The executor's write layer. It goes through the shared chart-data mutations on purpose: the read-only
// rule for a signed visit is enforced there, client-side, and not by the save-chart-data zambda.

import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useScribeRecommendationsStore } from 'src/features/visits/shared/components/scribe-recommendations/scribeRecommendations.store';
import { isVisitLockedError } from 'src/features/visits/shared/components/scribe-recommendations/useAutochartLock';
import { chartSectionsQueryKey, visitNoteQueryKey } from 'src/features/visits/shared/hooks/chartSectionCache';
import { useSaveChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { EASY_CHART_VISIT_LOCKED_MESSAGE } from 'utils/lib/easy-chart/access';
import { ChartWriter } from '../executor/types';
import { collectResourceIds, diffCreatedResourceIds } from './chart-resource-ids';

export function useChartWriter(encounterId: string): ChartWriter {
  const { mutateAsync: saveChartData } = useSaveChartData();
  const queryClient = useQueryClient();

  return useMemo<ChartWriter>(
    () => ({
      save: async (fields) => {
        // Every row id any cached chart entry for this encounter already holds, to diff the response against.
        const before = new Set<string>();
        for (const queryKey of [visitNoteQueryKey(encounterId), chartSectionsQueryKey(encounterId)]) {
          for (const [, cached] of queryClient.getQueriesData({ queryKey })) collectResourceIds(cached, before);
        }
        let response: Awaited<ReturnType<typeof saveChartData>>;
        try {
          response = await saveChartData(fields);
        } catch (error) {
          // A locked visit turns the panel read-only and reads as such on the row, not as "update disabled".
          if (isVisitLockedError(error)) {
            useScribeRecommendationsStore.getState().markVisitLocked();
            throw new Error(EASY_CHART_VISIT_LOCKED_MESSAGE);
          }
          throw error;
        }
        return diffCreatedResourceIds(before, collectResourceIds(response.chartData));
      },
    }),
    [saveChartData, queryClient, encounterId]
  );
}
