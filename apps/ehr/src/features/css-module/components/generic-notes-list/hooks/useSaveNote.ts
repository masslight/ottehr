import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { GetChartDataResponse, NoteDTO } from 'utils';
import useEvolveUser from '../../../../../hooks/useEvolveUser';
import { useChartData } from '../../../../../telemed';
import { useOystehrAPIClient } from '../../../../../telemed/hooks/useOystehrAPIClient';
import { UseSaveNote } from '../types';
import { useChartDataCacheKey } from './useChartDataCacheKey';

export const useSaveNote: UseSaveNote = ({ encounterId, appointmentId, patientId, apiConfig }) => {
  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();
  const queryClient = useQueryClient();
  const cacheKey = useChartDataCacheKey(apiConfig.fieldName, apiConfig.searchParams);

  const { chartDataRefetch: refetch } = useChartData({
    appointmentId,
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
        }) as GetChartDataResponse | undefined;

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
