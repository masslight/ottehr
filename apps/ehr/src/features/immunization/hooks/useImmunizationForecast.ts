import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import {
  ClearImmunizationMarkRequest,
  ClearImmunizationMarkResponse,
  GetImmunizationForecastRequest,
  GetImmunizationForecastResponse,
  SaveImmunizationMarkRequest,
  SaveImmunizationMarkResponse,
} from 'utils/lib/types/data/immunization/types';
import { GET_PATIENT_IMMUNIZATIONS_KEY } from '../../visits/in-person/hooks/useImmunization';

const GET_IMMUNIZATION_FORECAST_KEY = 'get-immunization-forecast';

/** The patient's forecast computed server-side, with the dose records and marks it was computed from. */
export const useGetImmunizationForecast = (
  input: Partial<GetImmunizationForecastRequest>
): UseQueryResult<GetImmunizationForecastResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [GET_IMMUNIZATION_FORECAST_KEY, input.patientId, input.asOf],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({ ...input, id: GET_IMMUNIZATION_FORECAST_KEY });
      return chooseJson(response);
    },
    enabled: oystehrZambda != null && Boolean(input.patientId),
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};

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
