import { useCallback } from 'react';
import useEvolveUser from '../../../../../hooks/useEvolveUser';
import { useChartData } from '../../../hooks/useChartData';
import { GetChartDataResponse, VitalsObservationDTO } from 'utils';
import { UseSaveVitals } from '../types';
import { useChartDataCacheKey } from '../../generic-notes-list/hooks/useChartDataCacheKey';
import { useQueryClient } from 'react-query';
import { useZapEHRAPIClient } from '../../../../../telemed/hooks/useOystehrAPIClient';

export const useSaveVitals: UseSaveVitals = ({ encounterId, searchConfig }) => {
  const apiClient = useZapEHRAPIClient();
  const queryClient = useQueryClient();
  const user = useEvolveUser();
  const cacheKey = useChartDataCacheKey(searchConfig.fieldName, searchConfig.searchParams);

  const { refetch } = useChartData({
    encounterId,
    requestedFields: { [searchConfig.fieldName]: searchConfig.searchParams },
  });

  const handleSave = useCallback(
    async (vitalEntity: VitalsObservationDTO): Promise<void> => {
      if (!user) throw new Error('User not found');

      const payload = {
        encounterId: encounterId,
        [searchConfig.fieldName]: [vitalEntity],
      };

      const saveResult = await apiClient?.saveChartData?.(payload);
      const savedData = saveResult?.chartData?.[searchConfig.fieldName];

      if (savedData) {
        const result = queryClient.setQueryData(cacheKey, (oldData: any) => {
          if (oldData?.[searchConfig.fieldName]) {
            return {
              ...oldData,
              [searchConfig.fieldName]: [
                ...savedData,
                ...oldData[searchConfig.fieldName],
              ] as GetChartDataResponse[typeof searchConfig.fieldName],
            };
          }
          return oldData;
        });

        if (result?.[searchConfig.fieldName] === undefined) {
          // refetch all if the cache didn't found
          await refetch();
        }
      }
    },
    [apiClient, cacheKey, encounterId, queryClient, refetch, searchConfig, user]
  );

  return handleSave;
};
