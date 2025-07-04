import { useCallback } from 'react';
import { useQueryClient } from 'react-query';
import { GetChartDataResponse, NoteDTO } from 'utils';
import useEvolveUser from '../../../../../hooks/useEvolveUser';
import { useOystehrAPIClient } from '../../../../../telemed/hooks/useOystehrAPIClient';
import { useChartData } from '../../../hooks/useChartData';
import { UseSaveNote } from '../types';
import { useChartDataCacheKey } from './useChartDataCacheKey';

export const useSaveNote: UseSaveNote = ({ encounterId, patientId, apiConfig }) => {
  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();
  const queryClient = useQueryClient();
  const cacheKey = useChartDataCacheKey(apiConfig.fieldName, apiConfig.searchParams);

  const { refetch } = useChartData({
    encounterId,
    requestedFields: { [apiConfig.fieldName]: apiConfig.searchParams },
  });

  const handleSave = useCallback(
    async (text: string): Promise<void> => {
      if (!user) throw new Error('User not found');

      const newNote: NoteDTO = {
        type: apiConfig.type,
        text,
        authorId: user.profile?.split('/')?.[1] ?? 'unknown',
        authorName: user.userName,
        patientId,
        encounterId,
      };

      const saveResult = await apiClient?.saveChartData?.({
        encounterId: encounterId,
        [apiConfig.fieldName]: [newNote],
      });

      const savedData = saveResult?.chartData?.[apiConfig.fieldName];

      if (savedData) {
        const result = queryClient.setQueryData(cacheKey, (oldData: any) => {
          if (oldData?.[apiConfig.fieldName]) {
            return {
              ...oldData,
              [apiConfig.fieldName]: [
                ...savedData,
                ...oldData[apiConfig.fieldName],
              ] as GetChartDataResponse[typeof apiConfig.fieldName],
            };
          }
          return oldData;
        });

        if (result?.[apiConfig.fieldName] === undefined) {
          // refetch all if the cache didn't found
          await refetch();
        }
      }
    },
    [user, apiConfig, patientId, encounterId, apiClient, queryClient, cacheKey, refetch]
  );

  return handleSave;
};
