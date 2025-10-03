import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import { AllChartValues, GetChartDataResponse } from 'utils';
import { useChartFields, useDeleteChartData } from '../../../../../telemed';
import { EditableNote, UseDeleteNote } from '../types';

/*
      by default react-query updates cache by keys; we do the same but we make it a bit more smart for our case. 
      we update each specific fields from the request params for the all caches which are contains this field and this search params, 
      it's a safe because we are updating exactly field with exactly search params which is means if that request will be repeated it returns 
      exactly the same data

      1. use useChartData with searchParams as we wish everywhere
      2. think about mutations subsequences updates after that - we can just refetch all the queries which is contained specific field

      goal:
      - no common cache (in sense of when components asks like give to me 'observations', it should instead ask for like give me 'observations for THIS search params' and then all queries contains this field with this search params should update that param). react query cache is a key-value storage, so make updates by exactly keys is safe and effective.
      - have to simple way to refetch the data after mutation. scope: field, field + search params, zustand like API
      - set stole time > 0 for the all fetch requests, because we have auto invalidations for the cache setter

      API usage and changes:
      ```

      useChartData() // doesn't have searchParams anymore
      
      const {data, setQueryCache, ...rest} = useChartDataField({searchParams: {field1: searchParams, field2: searchParams2}})

      // inside function the each key from cb return will be updated (only for corresponding search params) AND invalidates all the cache which is contained this fields but different searchParameters:
      setQueryCache((data) => ({field1: ..., field2: ...})) 
      or setQueryCache({field1: ..., field2: ...})

      // additional hook
      const invalidateQueryCache = useInvalidateChartDataFieldCache()
      invalidateQueryCache(['field1', 'field2'])
      invalidateQueryCache('all')

      The hook return base react-query API and to custom helpers - setQueryCache, invalidateQueryCache. For the rest operations suggested to use default react query API
      ```
*/

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
