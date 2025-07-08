import { useCallback } from 'react';
import { useQueryClient } from 'react-query';
import { GetChartDataResponse, NoteDTO } from 'utils';
import useEvolveUser from '../../../../../hooks/useEvolveUser';
import { useOystehrAPIClient } from '../../../../../telemed/hooks/useOystehrAPIClient';
import { useChartData } from '../../../hooks/useChartData';
import { EditableNote, UseEditNote } from '../types';
import { useChartDataCacheKey } from './useChartDataCacheKey';

export const useEditNote: UseEditNote = ({ encounterId, apiConfig }) => {
  const apiClient = useOystehrAPIClient();
  const queryClient = useQueryClient();
  const user = useEvolveUser();
  const cacheKey = useChartDataCacheKey(apiConfig.fieldName, apiConfig.searchParams);

  const { refetch } = useChartData({
    encounterId,
    requestedFields: { [apiConfig.fieldName]: apiConfig.searchParams },
  });

  const handleEdit = useCallback(
    async (entity: EditableNote, newText: string): Promise<void> => {
      const updatedNote: NoteDTO = {
        resourceId: entity.resourceId,
        type: entity.type,
        text: newText,
        authorId: user?.profile?.split('/')?.[1] ?? 'unknown',
        authorName: user?.userName ?? '',
        patientId: entity.patientId,
        encounterId: entity.encounterId,
      };

      await apiClient?.saveChartData?.({
        encounterId: entity.encounterId,
        [apiConfig.fieldName]: [updatedNote],
      });

      const result = queryClient.setQueryData(cacheKey, (oldData: any) => {
        if (oldData?.[apiConfig.fieldName]) {
          return {
            ...oldData,
            [apiConfig.fieldName]: (
              oldData[apiConfig.fieldName] as GetChartDataResponse[typeof apiConfig.fieldName]
            )?.map((note) => {
              if (note.resourceId === updatedNote.resourceId) {
                return { ...note, ...updatedNote };
              }
              return note;
            }),
          };
        }
        return oldData;
      });

      if (result?.[apiConfig.fieldName] === undefined) {
        // refetch all if the cache didn't found
        await refetch();
      }
    },
    [user?.profile, user?.userName, apiClient, apiConfig, queryClient, cacheKey, refetch]
  );

  return handleEdit;
};
