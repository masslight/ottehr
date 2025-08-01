import { useCallback } from 'react';
import { VitalsObservationDTO } from 'utils';
import useEvolveUser from '../../../../../hooks/useEvolveUser';
import { useOystehrAPIClient } from '../../../../../telemed/hooks/useOystehrAPIClient';
import { UseSaveVitals } from '../types';

export const useSaveVitals: UseSaveVitals = ({ encounterId }) => {
  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();

  const handleSave = useCallback(
    async (vitalEntity: VitalsObservationDTO): Promise<void> => {
      if (!user) throw new Error('User not found');

      const payload = {
        encounterId: encounterId,
        vitalsObservations: [vitalEntity],
      };

      await apiClient?.saveChartData?.(payload);
    },
    [apiClient, encounterId, user]
  );

  return handleSave;
};
