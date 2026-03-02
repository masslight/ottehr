import { useQuery } from '@tanstack/react-query';
import { QUERY_STALE_TIME } from 'src/constants';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { ProcedureDTO } from 'utils';

type ProcedureWithEncounterId = ProcedureDTO & { encounterId: string };

interface UseGetProceduresParams {
  encounterIds: string[];
}

interface UseGetProceduresOutput {
  procedures: ProcedureWithEncounterId[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export const useGetProcedures = ({ encounterIds }: UseGetProceduresParams): UseGetProceduresOutput => {
  const apiClient = useOystehrAPIClient();
  const hasEncounters = encounterIds.length > 0;

  const query = useQuery({
    queryKey: ['procedures-for-tracking-board', encounterIds.sort().join(',')],
    queryFn: async () => {
      if (!apiClient) {
        throw new Error('API client not defined');
      }
      if (!hasEncounters) {
        return [];
      }

      // Use the first encounterId as the main encounter, but pass all encounterIds in requestedFields
      const chartData = await apiClient.getChartData({
        encounterId: encounterIds[0],
        requestedFields: {
          procedures: { encounterIds },
        },
      });

      // Map procedures to include encounterId from the encounter reference
      return (
        chartData?.procedures?.map((procedure) => ({
          ...procedure,
          encounterId: procedure.encounterId || '',
        })) ?? []
      );
    },
    enabled: !!apiClient && hasEncounters,
    staleTime: QUERY_STALE_TIME,
  });

  return {
    procedures: (query.data ?? []) as ProcedureWithEncounterId[],
    isLoading: query.isLoading,
    refetch: async () => {
      await query.refetch();
    },
  };
};
