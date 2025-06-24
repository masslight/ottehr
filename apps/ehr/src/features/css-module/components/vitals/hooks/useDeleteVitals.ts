import { useCallback } from 'react';
import { useQueryClient } from 'react-query';
import { ChartDataFields, GetChartDataResponse, VitalsObservationDTO } from 'utils';
import { useDeleteChartData } from '../../../../../telemed';
import { useChartData } from '../../../hooks/useChartData';
import { useChartDataCacheKey } from '../../generic-notes-list/hooks/useChartDataCacheKey';
import { UseDeleteVitals } from '../types';

export const useDeleteVitals: UseDeleteVitals = ({ encounterId, searchConfig }) => {
  const queryClient = useQueryClient();
  const { mutate: deleteChartData } = useDeleteChartData();

  const { refetch } = useChartData({
    encounterId,
    requestedFields: { [searchConfig.fieldName]: searchConfig.searchParams },
  });

  const cacheKey = useChartDataCacheKey(searchConfig.fieldName, searchConfig.searchParams);

  const handleDelete = useCallback(
    async (entity: VitalsObservationDTO): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        deleteChartData({ [searchConfig.fieldName]: [{ resourceId: entity.resourceId }] } as ChartDataFields, {
          onSuccess: async () => {
            try {
              const result = queryClient.setQueryData(cacheKey, (oldData: any) => {
                if (oldData?.[searchConfig.fieldName]) {
                  return {
                    ...oldData,
                    [searchConfig.fieldName]: (
                      oldData[searchConfig.fieldName] as GetChartDataResponse[typeof searchConfig.fieldName]
                    )?.filter((note) => note?.resourceId !== entity.resourceId),
                  };
                }
                return oldData;
              });
              if (result?.[searchConfig.fieldName] === undefined) {
                // refetch all if the cache didn't found
                await refetch();
              }
              resolve();
            } catch (error) {
              console.error(error);
              reject(error);
            }
          },
          onError: (error) => {
            console.error(error);
            reject(error);
          },
        });
      });
    },
    [cacheKey, deleteChartData, queryClient, refetch, searchConfig]
  );

  return handleDelete;
};
