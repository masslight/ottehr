import { useCallback } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { VitalsObservationDTO } from 'utils';
import { useOystehrAPIClient } from '../../../hooks/useOystehrAPIClient';

export type UseBatchSaveVitals = (props: {
  encounterId: string;
}) => (vitalEntities: VitalsObservationDTO[]) => Promise<void>;

export const useBatchSaveVitals: UseBatchSaveVitals = ({ encounterId }) => {
  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();

  const handleBatchSave = useCallback(
    async (vitalEntities: VitalsObservationDTO[]): Promise<void> => {
      if (!user) throw new Error('User not found');

      const payload = {
        encounterId: encounterId,
        vitalsObservations: vitalEntities,
      };

      await apiClient?.saveChartData?.(payload);
    },
    [apiClient, encounterId, user]
  );

  return handleBatchSave;
};
