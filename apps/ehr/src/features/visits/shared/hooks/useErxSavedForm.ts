import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { erxSavedForm } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { ErxSavedForm, ErxSavedFormResponse } from 'utils/lib/types/api/erx.types';

const erxSavedFormKey = (encounterId: string | undefined): unknown[] => ['erx-saved-form', encounterId];

/** The visit's eRx order form saved for a provider to send (requirement 53b), shared by the eRx page and signing. */
export const useErxSavedForm = (encounterId: string | undefined): UseQueryResult<ErxSavedFormResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: erxSavedFormKey(encounterId),
    queryFn: () => erxSavedForm(oystehrZambda!, { action: 'get', encounterId: encounterId! }),
    enabled: !!oystehrZambda && !!encounterId,
  });
};

/** Saves the form in place of the visit's saved one; an empty form removes it. */
export const useSaveErxForm = (
  encounterId: string | undefined
): UseMutationResult<ErxSavedFormResponse, Error, ErxSavedForm> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: ErxSavedForm) => {
      if (!oystehrZambda || !encounterId) throw new Error('Please reload and try again.');
      return erxSavedForm(oystehrZambda, { action: 'save', encounterId, form });
    },
    onSuccess: (response) => queryClient.setQueryData(erxSavedFormKey(encounterId), response),
  });
};
