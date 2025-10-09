import { useCallback } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { GetChartDataResponse, NoteDTO } from 'utils';
import { useChartFields } from '../../../hooks/useChartFields';
import { useOystehrAPIClient } from '../../../hooks/useOystehrAPIClient';
import { UseSaveNote } from '../types';

export const useSaveNote: UseSaveNote = ({ encounterId, appointmentId, patientId, apiConfig }) => {
  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();

  const { setQueryCache } = useChartFields({
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
        setQueryCache((oldData: any) => {
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
      }
    },
    [user, apiConfig, patientId, encounterId, apiClient, setQueryCache]
  );

  return handleSave;
};
