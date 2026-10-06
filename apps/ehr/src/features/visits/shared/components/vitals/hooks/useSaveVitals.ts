import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { invalidateChartSections } from '../../../hooks/chartSectionCache';
import { useChartSection } from '../../../hooks/useChartSection';
import { useOystehrAPIClient } from '../../../hooks/useOystehrAPIClient';
import { autoAddVisionCptCodes } from './visionCptAutoAdd';

export type UseSaveVitals = (props: { encounterId: string }) => (vitalEntity: VitalsObservationDTO) => Promise<void>;

export const useSaveVitals: UseSaveVitals = ({ encounterId }) => {
  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();
  const { oystehr } = useApiClients();
  const { data: assessment } = useChartSection('assessment', { encounterId });
  const queryClient = useQueryClient();

  const handleSave = useCallback(
    async (vitalEntity: VitalsObservationDTO): Promise<void> => {
      if (!user) throw new Error('User not found');

      const payload = {
        encounterId: encounterId,
        vitalsObservations: [vitalEntity],
      };

      await apiClient?.saveChartData?.(payload);

      const existingCptCodes = new Set(assessment?.cptCodes.map((code) => code.code) ?? []);
      await autoAddVisionCptCodes({
        vitals: [vitalEntity],
        encounterId,
        existingCptCodes,
        apiClient,
        oystehr,
        onCptCodesAdded: () => invalidateChartSections(queryClient, encounterId, ['assessment']),
      });
    },
    [apiClient, encounterId, user, oystehr, assessment, queryClient]
  );

  return handleSave;
};
