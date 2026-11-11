import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import {
  ClearImmunizationMarkRequest,
  ClearImmunizationMarkResponse,
  SaveImmunizationMarkRequest,
  SaveImmunizationMarkResponse,
} from 'utils/lib/types/data/immunization/types';
import {
  GET_IMMUNIZATION_FORECAST_KEY,
  GET_PATIENT_IMMUNIZATIONS_KEY,
} from '../../visits/in-person/hooks/useImmunization';

const useMarkMutation = <Request, Response>(zambdaId: string): UseMutationResult<Response, Error, Request> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Request) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({ ...input, id: zambdaId });
      return chooseJson(response);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [GET_IMMUNIZATION_FORECAST_KEY], exact: false });
      await queryClient.invalidateQueries({ queryKey: [GET_PATIENT_IMMUNIZATIONS_KEY], exact: false });
    },
  });
};

/** Marks a vaccine group Immune / Contraindicated / Declined; a new mark clears the active one into the history. */
export const useSaveImmunizationMark = (): UseMutationResult<
  SaveImmunizationMarkResponse,
  Error,
  SaveImmunizationMarkRequest
> => useMarkMutation<SaveImmunizationMarkRequest, SaveImmunizationMarkResponse>('save-immunization-mark');

/** Clears a mark; the mark stays in the history with who cleared it and when. */
export const useClearImmunizationMark = (): UseMutationResult<
  ClearImmunizationMarkResponse,
  Error,
  ClearImmunizationMarkRequest
> => useMarkMutation<ClearImmunizationMarkRequest, ClearImmunizationMarkResponse>('clear-immunization-mark');
