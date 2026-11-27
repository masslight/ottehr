import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { invalidateChartSections } from '../../../hooks/chartSectionCache';
import { useChartSection } from '../../../hooks/useChartSection';
import { useOystehrAPIClient } from '../../../hooks/useOystehrAPIClient';
import { autoAddVisionCptCodes, resolveVisionCptCodes } from './visionCptAutoAdd';

export type UseBatchSaveVitals = (props: {
  encounterId: string;
}) => (vitalEntities: VitalsObservationDTO[]) => Promise<void>;

export const useBatchSaveVitals: UseBatchSaveVitals = ({ encounterId }) => {
  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();
  const { oystehr } = useApiClients();
  const { data: assessment } = useChartSection('assessment', { encounterId });
  const queryClient = useQueryClient();

  const handleBatchSave = useCallback(
    async (vitalEntities: VitalsObservationDTO[]): Promise<void> => {
      if (!user) throw new Error('User not found');

      const payload = {
        encounterId: encounterId,
        vitalsObservations: vitalEntities,
      };

      const existingCptCodes = new Set(assessment?.cptCodes.map((code) => code.code) ?? []);
      const [, visionCptCodes] = await Promise.all([
        apiClient?.saveChartData?.(payload),
        resolveVisionCptCodes({ vitals: vitalEntities, existingCptCodes, apiClient, oystehr }),
      ]);

      await autoAddVisionCptCodes({
        cptCodes: visionCptCodes,
        encounterId,
        apiClient,
        onCptCodesAdded: () => invalidateChartSections(queryClient, encounterId, ['assessment']),
      });
    },
    [apiClient, encounterId, user, oystehr, assessment, queryClient]
  );

  return handleBatchSave;
};
