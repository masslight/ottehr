import { useCallback } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useOystehrAPIClient } from 'src/telemed/hooks/useOystehrAPIClient';
import { VitalsObservationDTO } from 'utils';
import { UseDeleteVitals } from '../types';

export const useDeleteVitals: UseDeleteVitals = ({ encounterId }) => {
  const apiClient = useOystehrAPIClient();

  const user = useEvolveUser();

  const handleDelete = useCallback(
    async (vitalEntity: VitalsObservationDTO): Promise<void> => {
      if (!user) throw new Error('User not found');

      const payload = {
        encounterId: encounterId,
        vitalsObservations: [vitalEntity],
      };

      await apiClient?.deleteChartData?.(payload);
    },
    [apiClient, encounterId, user]
  );

  return handleDelete;
};
