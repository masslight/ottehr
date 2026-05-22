import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import { GetChartDataResponse, NoteDTO } from 'utils';
import { useChartFields } from '../../../hooks/useChartFields';
import { useOystehrAPIClient } from '../../../hooks/useOystehrAPIClient';
import { UseDeleteNote } from '../types';

// Soft-deletes a note by re-saving it with `deleted: true`. The backend flips
// Communication.status to 'entered-in-error' and preserves the original text/author for the audit
// trail. Matches the UseDeleteNote signature so callers can swap it in for the hard-delete hook.
export const useSoftDeleteNote: UseDeleteNote = ({ appointmentId, apiConfig, locales }) => {
  const apiClient = useOystehrAPIClient();
  const { setQueryCache } = useChartFields({
    appointmentId,
    requestedFields: { [apiConfig.fieldName]: apiConfig.searchParams },
  });

  return useCallback(
    async (entity) => {
      try {
        const payload: NoteDTO = {
          resourceId: entity.resourceId,
          type: entity.type,
          text: entity.text,
          authorId: entity.authorId,
          authorName: entity.authorName,
          patientId: entity.patientId,
          encounterId: entity.encounterId,
          deleted: true,
        };

        await apiClient?.saveChartData?.({
          encounterId: entity.encounterId,
          [apiConfig.fieldName]: [payload],
        });

        const deletedAt = new Date().toISOString();
        setQueryCache((oldData: any) => {
          if (!oldData?.[apiConfig.fieldName]) return oldData;
          return {
            ...oldData,
            [apiConfig.fieldName]: (
              oldData[apiConfig.fieldName] as GetChartDataResponse[typeof apiConfig.fieldName]
            )?.map((n) => (n.resourceId === entity.resourceId ? { ...n, deleted: true, lastUpdated: deletedAt } : n)),
          };
        });
      } catch (error) {
        console.error(error);
        enqueueSnackbar(locales.getErrorMessage('deletion', locales.entityLabel), { variant: 'error' });
        throw error;
      }
    },
    [apiClient, apiConfig, setQueryCache, locales]
  );
};
