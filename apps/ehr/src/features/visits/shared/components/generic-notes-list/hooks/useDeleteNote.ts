import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import { AllChartValues } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { useChartFields } from '../../../hooks/useChartFields';
import { useDeleteChartData } from '../../../stores/appointment/appointment.store';
import { EditableNote, UseDeleteNote } from '../types';

export const useDeleteNote: UseDeleteNote = ({ appointmentId, encounterId, apiConfig, locales }) => {
  const { mutate: deleteChartData } = useDeleteChartData();

  const { setQueryCache } = useChartFields({
    appointmentId,
    encounterId,
    requestedFields: { [apiConfig.fieldName]: apiConfig.searchParams },
  });

  const handleDelete = useCallback(
    async (entity: EditableNote): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        deleteChartData(
          // The cast stays on the dynamic field alone: `fieldName` is a runtime key, so it cannot be
          // narrowed here, but the encounter id is a real parameter of the mutation.
          { encounterId, ...({ [apiConfig.fieldName]: [{ resourceId: entity.resourceId }] } as AllChartValues) },
          {
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
          }
        );
      });
    },
    [apiConfig, deleteChartData, encounterId, locales, setQueryCache]
  );

  return handleDelete;
};
