import { useCallback } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { GetChartDataResponse, NoteDTO } from 'utils';
import { useChartFields } from '../../../hooks/useChartFields';
import { useOystehrAPIClient } from '../../../hooks/useOystehrAPIClient';
import { EditableNote, UseEditNote } from '../types';

export const useEditNote: UseEditNote = ({ appointmentId, apiConfig }) => {
  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();

  const { setQueryCache } = useChartFields({
    appointmentId,
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

      // Flip `edited` in the optimistic cache and bump lastUpdated so the "(edited)" marker
      // and timestamp appear immediately instead of waiting for a refetch.
      const editedAt = new Date().toISOString();

      setQueryCache((oldData: any) => {
        if (oldData?.[apiConfig.fieldName]) {
          return {
            ...oldData,
            [apiConfig.fieldName]: (
              oldData[apiConfig.fieldName] as GetChartDataResponse[typeof apiConfig.fieldName]
            )?.map((note) => {
              if (note.resourceId === updatedNote.resourceId) {
                return { ...note, ...updatedNote, lastUpdated: editedAt, edited: true };
              }
              return note;
            }),
          };
        }
        return oldData;
      }) as GetChartDataResponse | undefined;
    },
    [user?.profile, user?.userName, apiClient, apiConfig, setQueryCache]
  );

  return handleEdit;
};
