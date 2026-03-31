import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { CHART_DATA_QUERY_KEY } from 'src/constants';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { VitalsObservationDTO } from 'utils';
import { useOystehrAPIClient } from '../../../hooks/useOystehrAPIClient';
import { useChartData } from '../../../stores/appointment/appointment.store';
import { autoAddVisionCptCodes } from './visionCptAutoAdd';

export type UseSaveVitals = (props: { encounterId: string }) => (vitalEntity: VitalsObservationDTO) => Promise<void>;

export const useSaveVitals: UseSaveVitals = ({ encounterId }) => {
  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();
  const { oystehr } = useApiClients();
  const { chartData } = useChartData({ encounterId });
  const queryClient = useQueryClient();

  const handleSave = useCallback(
    async (vitalEntity: VitalsObservationDTO): Promise<void> => {
      if (!user) throw new Error('User not found');

      const payload = {
        encounterId: encounterId,
        vitalsObservations: [vitalEntity],
      };

      await apiClient?.saveChartData?.(payload);

      const existingCptCodes = new Set(chartData?.cptCodes?.map((code) => code.code) ?? []);
      await autoAddVisionCptCodes({
        vitals: [vitalEntity],
        encounterId,
        existingCptCodes,
        apiClient,
        oystehr,
        queryClient,
        chartDataQueryKey: CHART_DATA_QUERY_KEY,
      });
    },
    [apiClient, encounterId, user, oystehr, chartData, queryClient]
  );

  return handleSave;
};
