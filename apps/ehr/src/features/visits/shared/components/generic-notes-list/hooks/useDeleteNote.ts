import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import { AllChartValues, GetChartDataResponse } from 'utils';
import { useChartFields } from '../../../hooks/useChartFields';
import { useDeleteChartData } from '../../../stores/appointment/appointment.store';
import { EditableNote, UseDeleteNote } from '../types';

export const useDeleteNote: UseDeleteNote = ({ appointmentId, apiConfig, locales }) => {
  const { mutate: deleteChartData } = useDeleteChartData();

  const { setQueryCache } = useChartFields({
    appointmentId,
    requestedFields: { [apiConfig.fieldName]: apiConfig.searchParams },
  });

  const handleDelete = useCallback(
    async (entity: EditableNote): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        deleteChartData({ [apiConfig.fieldName]: [{ resourceId: entity.resourceId }] } as AllChartValues, {
          onSuccess: async () => {
            try {
              setQueryCache((oldData: any) => {
                if (oldData?.[apiConfig.fieldName]) {
                  return {
                    ...oldData,
                    [apiConfig.fieldName]: (
                      oldData[apiConfig.fieldName] as GetChartDataResponse[typeof apiConfig.fieldName]
                    )?.filter((note) => note?.resourceId !== entity.resourceId),
                  };
                }
                return oldData;
              });
              resolve();
            } catch (error) {
              console.error(error);
              enqueueSnackbar(locales.getErrorMessage('deletion', locales.entityLabel), { variant: 'error' });
              reject(error);
            }
          },
          onError: (error: any) => {
            console.error(error);
            enqueueSnackbar(locales.getErrorMessage('deletion', locales.entityLabel), { variant: 'error' });
            reject(error);
          },
        });
      });
    },
    [apiConfig, deleteChartData, locales, setQueryCache]
  );

  return handleDelete;
};
