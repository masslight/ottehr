import { useQuery } from '@tanstack/react-query';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { useOystehrAPIClient } from './useOystehrAPIClient';

export const useMainEncounterChartData = (
  enabled: boolean
): {
  data: GetChartDataResponse | null | undefined;
  isLoading: boolean;
} => {
  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();
  const { followUpOriginEncounter: mainEncounter } = useAppointmentData();

  // Fetch chart data from main encounter
  const { data, isLoading } = useQuery({
    queryKey: ['main-encounter-chart-data', mainEncounter?.id],
    queryFn: async () => {
      if (!apiClient || !mainEncounter?.id) {
        return null;
      }
      const response = await apiClient.getChartData({
        encounterId: mainEncounter.id,
      });
      return response;
    },
    enabled: !!apiClient && !!mainEncounter?.id && !!user && enabled,
  });

  return {
    data,
    isLoading,
  };
};
