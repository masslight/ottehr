import { useCallback } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { VitalsObservationDTO } from 'utils';
import { useOystehrAPIClient } from '../../../hooks/useOystehrAPIClient';

export type UseDeleteVitals = (props: { encounterId: string }) => (vitalEntity: VitalsObservationDTO) => Promise<void>;

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
