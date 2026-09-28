// The whole chart for Easy Chart, from the visit-note section cache every screen of the visit reads and
// writes, folded into the GetChartDataResponse shape by the same function the plan endpoint uses.

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { readVisitNoteFromCache } from 'src/features/visits/shared/hooks/legacyChartData';
import { useVisitNote } from 'src/features/visits/shared/hooks/useVisitNote';
import { wholeChartFromVisitNote } from 'utils/lib/easy-chart/visit-note-chart';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';

interface EasyChartData {
  chartData: GetChartDataResponse | undefined;
  /** Re-reads the note and returns it, for a caller that must act on the result before the next render. */
  refetch: () => Promise<GetChartDataResponse | undefined>;
}

export function useEasyChartData(encounterId: string | undefined, enabled = true): EasyChartData {
  // No refetch on mount: the visit screens keep these sections fresh, and callers refetch after writing.
  const note = useVisitNote({ encounterId, enabled: enabled && Boolean(encounterId), refetchOnMount: false });

  const chartData = useMemo(
    (): GetChartDataResponse | undefined => (note.data ? wholeChartFromVisitNote(note.data) : undefined),
    [note.data]
  );

  const noteRefetch = note.refetch;
  const queryClient = useQueryClient();
  const refetch = useCallback(async (): Promise<GetChartDataResponse | undefined> => {
    await noteRefetch();
    const fresh = encounterId ? readVisitNoteFromCache(queryClient, encounterId) : undefined;
    return fresh ? wholeChartFromVisitNote(fresh) : undefined;
  }, [noteRefetch, queryClient, encounterId]);

  return { chartData, refetch };
}
